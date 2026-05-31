/// GoalFlow — 目標與資金分配核心模組
///
/// 功能：
/// - 使用者建立財務目標 (Goal Object)
/// - 自動分配計畫 (AllocationPlan)
/// - 衝動消費冷靜期保護
/// - 目標達成觸發事件
module goalflow::goal_flow {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use std::string::String;
    use std::vector;

    // ===== 錯誤碼 =====
    const E_NOT_OWNER:           u64 = 1000;
    const E_GOAL_NOT_ACTIVE:     u64 = 1001;
    const E_INVALID_AMOUNT:      u64 = 1002;
    const E_COOLING_OFF_ACTIVE:  u64 = 1003;
    const E_ALLOCATION_OVERFLOW: u64 = 1004;
    const E_PROFILE_EXISTS:      u64 = 1005;

    // ===== 目標狀態 =====
    const STATUS_ACTIVE:    u8 = 0;
    const STATUS_COMPLETED: u8 = 1;
    const STATUS_CANCELLED: u8 = 2;
    const STATUS_PAUSED:    u8 = 3;

    // ===== 目標類別 =====
    const CAT_SAVINGS:    u8 = 0;   // 一般儲蓄
    const CAT_INVESTMENT: u8 = 1;   // 投資
    const CAT_EMERGENCY:  u8 = 2;   // 緊急備用金
    const CAT_TRAVEL:     u8 = 3;   // 旅遊
    const CAT_EDUCATION:  u8 = 4;   // 教育
    const CAT_OTHER:      u8 = 5;   // 其他

    // ===== 風險等級 =====
    const RISK_CONSERVATIVE: u8 = 1;  // 保守
    const RISK_BALANCED:     u8 = 2;  // 穩健
    const RISK_AGGRESSIVE:   u8 = 3;  // 積極

    // ===============================
    // 物件結構
    // ===============================

    /// 使用者全局設定檔 (owned object)
    struct UserProfile has key, store {
        id: UID,
        owner: address,
        monthly_income: u64,       // 單位: MIST (1 SUI = 10^9 MIST)
        risk_level: u8,
        daily_budget: u64,         // 每日消費上限
        impulse_cooldown_ms: u64,  // 衝動冷靜期毫秒數 (預設 24h = 86400000)
        created_at: u64,
        updated_at: u64,
    }

    /// 財務目標 (owned object，支援資產鎖倉)
    struct Goal has key, store {
        id: UID,
        owner: address,
        name: String,
        emoji: String,
        color: String,
        target_amount: u64,
        current_amount: u64,
        locked_balance: Balance<SUI>,  // 真實鎖倉的 SUI
        deadline_ms: u64,
        category: u8,
        status: u8,
        cooling_off_until_ms: u64,    // 0 = 無冷靜期
        risk_level: u8,
        created_at: u64,
    }

    /// 分配條目
    struct AllocationEntry has store, copy, drop {
        goal_id: ID,
        basis_points: u64,   // 分配比例，10000 = 100%
        monthly_target: u64, // 每月目標金額
    }

    /// 自動分配計畫 (owned object)
    struct AllocationPlan has key, store {
        id: UID,
        owner: address,
        monthly_income: u64,
        emergency_basis_points: u64,   // 緊急備用金比例
        investment_basis_points: u64,  // DeFi / 投資比例
        goal_entries: vector<AllocationEntry>,
        defi_enabled: bool,
        updated_at: u64,
    }

    // ===============================
    // 事件
    // ===============================

    struct ProfileCreated has copy, drop {
        owner: address,
        monthly_income: u64,
        risk_level: u8,
    }

    struct GoalCreated has copy, drop {
        goal_id: ID,
        owner: address,
        name: String,
        target_amount: u64,
        deadline_ms: u64,
        category: u8,
    }

    struct ProgressDeposited has copy, drop {
        goal_id: ID,
        owner: address,
        amount: u64,
        new_total: u64,
        is_locked: bool,       // 是否真實鎖倉 SUI
    }

    struct GoalCompleted has copy, drop {
        goal_id: ID,
        owner: address,
        total_saved: u64,
    }

    struct AllocationExecuted has copy, drop {
        owner: address,
        total_amount: u64,
        emergency_amount: u64,
        investment_amount: u64,
        goal_amounts: vector<u64>,
    }

    struct CoolingOffSet has copy, drop {
        goal_id: ID,
        owner: address,
        cooling_off_until_ms: u64,
    }

    // ===============================
    // 初始化
    // ===============================

    // (無需 init，因為每位使用者自行呼叫 create_profile)

    // ===============================
    // Entry Functions — 使用者設定
    // ===============================

    /// 建立使用者設定檔
    /// 前端呼叫時機：Onboarding Step 1
    public entry fun create_profile(
        monthly_income: u64,
        risk_level: u8,
        daily_budget: u64,
        impulse_cooldown_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let profile = UserProfile {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            monthly_income,
            risk_level,
            daily_budget,
            impulse_cooldown_ms,
            created_at: clock::timestamp_ms(clock),
            updated_at: clock::timestamp_ms(clock),
        };
        event::emit(ProfileCreated {
            owner: profile.owner,
            monthly_income,
            risk_level,
        });
        transfer::transfer(profile, tx_context::sender(ctx));
    }

    /// 更新月收入與風險設定
    public entry fun update_profile(
        profile: &mut UserProfile,
        monthly_income: u64,
        risk_level: u8,
        daily_budget: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(profile.owner == tx_context::sender(ctx), E_NOT_OWNER);
        profile.monthly_income = monthly_income;
        profile.risk_level = risk_level;
        profile.daily_budget = daily_budget;
        profile.updated_at = clock::timestamp_ms(clock);
    }

    // ===============================
    // Entry Functions — 目標管理
    // ===============================

    /// 建立新目標
    /// 前端呼叫時機：Goals 頁面「建立目標」
    public entry fun create_goal(
        profile: &UserProfile,
        name: String,
        emoji: String,
        color: String,
        target_amount: u64,
        deadline_ms: u64,
        category: u8,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(profile.owner == tx_context::sender(ctx), E_NOT_OWNER);
        assert!(target_amount > 0, E_INVALID_AMOUNT);

        let now = clock::timestamp_ms(clock);
        let goal = Goal {
            id: object::new(ctx),
            owner: profile.owner,
            name,
            emoji,
            color,
            target_amount,
            current_amount: 0,
            locked_balance: balance::zero<SUI>(),
            deadline_ms,
            category,
            status: STATUS_ACTIVE,
            cooling_off_until_ms: 0,
            risk_level: profile.risk_level,
            created_at: now,
        };
        event::emit(GoalCreated {
            goal_id: object::id(&goal),
            owner: goal.owner,
            name: goal.name,
            target_amount,
            deadline_ms,
            category,
        });
        transfer::transfer(goal, tx_context::sender(ctx));
    }

    /// 存入進度（追蹤數字，不鎖倉）
    /// 前端呼叫時機：手動記帳時連結目標
    public entry fun record_progress(
        goal: &mut Goal,
        amount: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(goal.owner == tx_context::sender(ctx), E_NOT_OWNER);
        assert!(goal.status == STATUS_ACTIVE, E_GOAL_NOT_ACTIVE);
        assert!(amount > 0, E_INVALID_AMOUNT);
        let now = clock::timestamp_ms(clock);
        assert!(goal.cooling_off_until_ms == 0 || now > goal.cooling_off_until_ms, E_COOLING_OFF_ACTIVE);

        goal.current_amount = goal.current_amount + amount;

        event::emit(ProgressDeposited {
            goal_id: object::id(goal),
            owner: goal.owner,
            amount,
            new_total: goal.current_amount,
            is_locked: false,
        });

        if (goal.current_amount >= goal.target_amount) {
            goal.status = STATUS_COMPLETED;
            event::emit(GoalCompleted {
                goal_id: object::id(goal),
                owner: goal.owner,
                total_saved: goal.current_amount,
            });
        };
    }

    /// 真實鎖倉 SUI 存入目標
    /// 前端呼叫時機：連接錢包後真實轉帳
    public entry fun deposit_sui_to_goal(
        goal: &mut Goal,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(goal.owner == tx_context::sender(ctx), E_NOT_OWNER);
        assert!(goal.status == STATUS_ACTIVE, E_GOAL_NOT_ACTIVE);
        let now = clock::timestamp_ms(clock);
        assert!(goal.cooling_off_until_ms == 0 || now > goal.cooling_off_until_ms, E_COOLING_OFF_ACTIVE);

        let amount = coin::value(&payment);
        assert!(amount > 0, E_INVALID_AMOUNT);
        goal.current_amount = goal.current_amount + amount;

        let payment_balance = coin::into_balance(payment);
        balance::join(&mut goal.locked_balance, payment_balance);

        event::emit(ProgressDeposited {
            goal_id: object::id(goal),
            owner: goal.owner,
            amount,
            new_total: goal.current_amount,
            is_locked: true,
        });

        if (goal.current_amount >= goal.target_amount) {
            goal.status = STATUS_COMPLETED;
            event::emit(GoalCompleted {
                goal_id: object::id(goal),
                owner: goal.owner,
                total_saved: goal.current_amount,
            });
        };
    }

    /// 設定衝動消費冷靜期
    /// 前端呼叫時機：大額購買前觸發
    public entry fun set_cooling_off(
        goal: &mut Goal,
        profile: &UserProfile,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(goal.owner == tx_context::sender(ctx), E_NOT_OWNER);
        let until = clock::timestamp_ms(clock) + profile.impulse_cooldown_ms;
        goal.cooling_off_until_ms = until;
        event::emit(CoolingOffSet {
            goal_id: object::id(goal),
            owner: goal.owner,
            cooling_off_until_ms: until,
        });
    }

    /// 取消冷靜期（使用者確認不衝動消費）
    public entry fun cancel_cooling_off(
        goal: &mut Goal,
        ctx: &mut TxContext,
    ) {
        assert!(goal.owner == tx_context::sender(ctx), E_NOT_OWNER);
        goal.cooling_off_until_ms = 0;
    }

    /// 提取已完成目標的鎖倉資金
    public entry fun withdraw_completed_goal(
        goal: &mut Goal,
        ctx: &mut TxContext,
    ) {
        assert!(goal.owner == tx_context::sender(ctx), E_NOT_OWNER);
        assert!(goal.status == STATUS_COMPLETED, E_GOAL_NOT_ACTIVE);
        let amount = balance::value(&goal.locked_balance);
        if (amount > 0) {
            let coin = coin::from_balance(
                balance::split(&mut goal.locked_balance, amount),
                ctx,
            );
            transfer::public_transfer(coin, goal.owner);
        };
    }

    /// 暫停 / 繼續目標
    public entry fun set_goal_status(
        goal: &mut Goal,
        new_status: u8,
        ctx: &mut TxContext,
    ) {
        assert!(goal.owner == tx_context::sender(ctx), E_NOT_OWNER);
        assert!(new_status == STATUS_PAUSED || new_status == STATUS_ACTIVE, E_GOAL_NOT_ACTIVE);
        goal.status = new_status;
    }

    // ===============================
    // Entry Functions — 自動分配
    // ===============================

    /// 建立或更新分配計畫
    /// 前端呼叫時機：Goals 頁調整分配比例後儲存
    public entry fun save_allocation_plan(
        monthly_income: u64,
        emergency_bp: u64,
        investment_bp: u64,
        goal_ids: vector<ID>,
        goal_bps: vector<u64>,
        goal_monthly_targets: vector<u64>,
        defi_enabled: bool,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let total_bp = emergency_bp + investment_bp;
        let i = 0;
        let len = vector::length(&goal_bps);
        while (i < len) {
            total_bp = total_bp + *vector::borrow(&goal_bps, i);
            i = i + 1;
        };
        assert!(total_bp <= 10000, E_ALLOCATION_OVERFLOW);

        let entries = vector::empty<AllocationEntry>();
        let j = 0;
        while (j < len) {
            vector::push_back(&mut entries, AllocationEntry {
                goal_id: *vector::borrow(&goal_ids, j),
                basis_points: *vector::borrow(&goal_bps, j),
                monthly_target: *vector::borrow(&goal_monthly_targets, j),
            });
            j = j + 1;
        };

        let plan = AllocationPlan {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            monthly_income,
            emergency_basis_points: emergency_bp,
            investment_basis_points: investment_bp,
            goal_entries: entries,
            defi_enabled,
            updated_at: clock::timestamp_ms(clock),
        };
        transfer::transfer(plan, tx_context::sender(ctx));
    }

    /// 執行自動分配（發出事件供前端 / indexer 處理）
    public entry fun execute_allocation(
        plan: &AllocationPlan,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(plan.owner == tx_context::sender(ctx), E_NOT_OWNER);
        let total = coin::value(&payment);

        let emergency_amount = (total * plan.emergency_basis_points) / 10000;
        let investment_amount = (total * plan.investment_basis_points) / 10000;

        let goal_amounts = vector::empty<u64>();
        let i = 0;
        let len = vector::length(&plan.goal_entries);
        while (i < len) {
            let entry = vector::borrow(&plan.goal_entries, i);
            vector::push_back(&mut goal_amounts, (total * entry.basis_points) / 10000);
            i = i + 1;
        };

        event::emit(AllocationExecuted {
            owner: plan.owner,
            total_amount: total,
            emergency_amount,
            investment_amount,
            goal_amounts,
        });

        // 退回剩餘 (實際應拆分後分別轉帳)
        transfer::public_transfer(payment, plan.owner);
    }

    // ===============================
    // 讀取函式 (view functions)
    // ===============================

    public fun get_goal_progress_pct(goal: &Goal): u64 {
        if (goal.target_amount == 0) return 100;
        (goal.current_amount * 100) / goal.target_amount
    }

    public fun get_monthly_gap(goal: &Goal, months_left: u64): u64 {
        if (goal.current_amount >= goal.target_amount || months_left == 0) return 0;
        let remaining = goal.target_amount - goal.current_amount;
        (remaining + months_left - 1) / months_left
    }

    public fun is_cooling_off(goal: &Goal, clock: &Clock): bool {
        goal.cooling_off_until_ms > 0 && clock::timestamp_ms(clock) < goal.cooling_off_until_ms
    }

    public fun get_locked_balance(goal: &Goal): u64 {
        balance::value(&goal.locked_balance)
    }
}
