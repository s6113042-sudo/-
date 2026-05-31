/// GoalFlow — 獎勵系統模組
///
/// 功能：
/// - 每日簽到 XP / 點數
/// - 連續簽到獎勵（返現點數）
/// - 成就系統（徽章 NFT）
/// - 寵物進化（蛋 → 小雞 → 雞）
module goalflow::rewards {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::vector;

    // ===== 錯誤碼 =====
    const E_NOT_OWNER:           u64 = 2000;
    const E_ALREADY_CHECKED_IN:  u64 = 2001;
    const E_NO_CASHBACK:         u64 = 2002;
    const E_BADGE_EXISTS:        u64 = 2003;

    // ===== XP 常量 =====
    const BASE_XP:               u64 = 10;
    const BASE_POINTS:           u64 = 5;
    const STREAK_7_XP_BONUS:     u64 = 15;
    const STREAK_30_XP_BONUS:    u64 = 40;
    const STREAK_100_XP_BONUS:   u64 = 100;
    const XP_PER_LEVEL:          u64 = 200;

    // 每日以 epoch 毫秒轉換為「日 index」
    const MS_PER_DAY: u64 = 86_400_000;

    // ===== 成就類型 =====
    const ACH_FIRST_GOAL:     u8 = 1;
    const ACH_GOAL_COMPLETE:  u8 = 2;
    const ACH_STREAK_7:       u8 = 3;
    const ACH_STREAK_30:      u8 = 4;
    const ACH_BUDGET_MASTER:  u8 = 5;
    const ACH_DEFI_USER:      u8 = 6;
    const ACH_PET_HATCH:      u8 = 7;
    const ACH_PET_GROW:       u8 = 8;

    // ===== 寵物階段 =====
    const PET_EGG:     u8 = 0;   // 0-3 級
    const PET_CHICK:   u8 = 1;   // 4-9 級
    const PET_CHICKEN: u8 = 2;   // 10+ 級
    const PET_LEGEND:  u8 = 3;   // 20+ 級 (特殊)

    // ===============================
    // 物件結構
    // ===============================

    /// 使用者獎勵帳戶 (owned object)
    struct RewardAccount has key, store {
        id: UID,
        owner: address,
        xp: u64,
        level: u64,
        points: u64,
        streak_days: u64,
        max_streak: u64,
        last_checkin_day: u64,     // 日 index (timestamp_ms / MS_PER_DAY)
        total_checkins: u64,
        pet_stage: u8,
        pet_xp: u64,
        badges: vector<u8>,
        pending_cashback: u64,     // 待領取點數返現
        created_at: u64,
    }

    // ===============================
    // 事件
    // ===============================

    struct CheckedIn has copy, drop {
        owner: address,
        xp_earned: u64,
        points_earned: u64,
        new_streak: u64,
        new_level: u64,
        day_index: u64,
    }

    struct LevelUp has copy, drop {
        owner: address,
        new_level: u64,
        pet_stage: u8,
    }

    struct AchievementUnlocked has copy, drop {
        owner: address,
        achievement_type: u8,
        points_reward: u64,
    }

    struct CashbackClaimed has copy, drop {
        owner: address,
        points: u64,
    }

    struct PetEvolved has copy, drop {
        owner: address,
        new_stage: u8,
    }

    // ===============================
    // Entry Functions
    // ===============================

    /// 建立獎勵帳戶（Onboarding 時呼叫）
    public entry fun create_reward_account(
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let account = RewardAccount {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            xp: 0,
            level: 1,
            points: 0,
            streak_days: 0,
            max_streak: 0,
            last_checkin_day: 0,
            total_checkins: 0,
            pet_stage: PET_EGG,
            pet_xp: 0,
            badges: vector::empty(),
            pending_cashback: 0,
            created_at: clock::timestamp_ms(clock),
        };
        transfer::transfer(account, tx_context::sender(ctx));
    }

    /// 每日簽到
    /// 前端呼叫時機：Rewards 頁面「簽到」按鈕
    public entry fun daily_checkin(
        account: &mut RewardAccount,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(account.owner == tx_context::sender(ctx), E_NOT_OWNER);

        let today = clock::timestamp_ms(clock) / MS_PER_DAY;
        assert!(account.last_checkin_day < today, E_ALREADY_CHECKED_IN);

        // 更新連續天數
        if (account.last_checkin_day + 1 == today) {
            account.streak_days = account.streak_days + 1;
        } else {
            account.streak_days = 1;
        };
        if (account.streak_days > account.max_streak) {
            account.max_streak = account.streak_days;
        };
        account.last_checkin_day = today;
        account.total_checkins = account.total_checkins + 1;

        // 計算 XP 與點數
        let xp = BASE_XP;
        let points = BASE_POINTS;
        if (account.streak_days >= 100) {
            xp = xp + STREAK_100_XP_BONUS;
            points = points + 50;
            account.pending_cashback = account.pending_cashback + 20;
        } else if (account.streak_days >= 30) {
            xp = xp + STREAK_30_XP_BONUS;
            points = points + 20;
            account.pending_cashback = account.pending_cashback + 10;
        } else if (account.streak_days >= 7) {
            xp = xp + STREAK_7_XP_BONUS;
            points = points + 10;
            account.pending_cashback = account.pending_cashback + 3;
        };

        let old_level = account.level;
        account.xp = account.xp + xp;
        account.points = account.points + points;
        account.pet_xp = account.pet_xp + xp;
        account.level = (account.xp / XP_PER_LEVEL) + 1;

        // 更新寵物階段
        let new_stage = calc_pet_stage(account.level);
        if (new_stage != account.pet_stage) {
            account.pet_stage = new_stage;
            event::emit(PetEvolved { owner: account.owner, new_stage });
        };

        event::emit(CheckedIn {
            owner: account.owner,
            xp_earned: xp,
            points_earned: points,
            new_streak: account.streak_days,
            new_level: account.level,
            day_index: today,
        });

        if (account.level > old_level) {
            event::emit(LevelUp {
                owner: account.owner,
                new_level: account.level,
                pet_stage: account.pet_stage,
            });
        };

        // 自動解鎖成就
        if (account.streak_days == 7) {
            try_unlock_badge(account, ACH_STREAK_7, 50);
        };
        if (account.streak_days == 30) {
            try_unlock_badge(account, ACH_STREAK_30, 200);
        };
    }

    /// 領取連續簽到返現
    public entry fun claim_cashback(
        account: &mut RewardAccount,
        ctx: &mut TxContext,
    ) {
        assert!(account.owner == tx_context::sender(ctx), E_NOT_OWNER);
        assert!(account.pending_cashback > 0, E_NO_CASHBACK);
        let amount = account.pending_cashback;
        account.pending_cashback = 0;
        account.points = account.points + amount;
        event::emit(CashbackClaimed { owner: account.owner, points: amount });
    }

    /// 外部呼叫：授予 XP（供 goal_flow.move 目標完成時呼叫）
    public fun award_xp(account: &mut RewardAccount, amount: u64) {
        let old_level = account.level;
        account.xp = account.xp + amount;
        account.pet_xp = account.pet_xp + amount;
        account.level = (account.xp / XP_PER_LEVEL) + 1;

        let new_stage = calc_pet_stage(account.level);
        if (new_stage != account.pet_stage) {
            account.pet_stage = new_stage;
            event::emit(PetEvolved { owner: account.owner, new_stage });
        };

        if (account.level > old_level) {
            event::emit(LevelUp {
                owner: account.owner,
                new_level: account.level,
                pet_stage: account.pet_stage,
            });
        };
    }

    /// 授予成就徽章
    /// 前端呼叫時機：達成條件後（建立第一個目標、完成目標等）
    public entry fun grant_achievement(
        account: &mut RewardAccount,
        achievement_type: u8,
        ctx: &mut TxContext,
    ) {
        assert!(account.owner == tx_context::sender(ctx), E_NOT_OWNER);
        let reward_points: u64 = get_achievement_points(achievement_type);
        try_unlock_badge(account, achievement_type, reward_points);
    }

    // ===============================
    // 內部輔助函式
    // ===============================

    fun try_unlock_badge(account: &mut RewardAccount, badge_type: u8, points_reward: u64) {
        if (!vector::contains(&account.badges, &badge_type)) {
            vector::push_back(&mut account.badges, badge_type);
            account.points = account.points + points_reward;
            event::emit(AchievementUnlocked {
                owner: account.owner,
                achievement_type: badge_type,
                points_reward,
            });
        };
    }

    fun calc_pet_stage(level: u64): u8 {
        if (level >= 20) PET_LEGEND
        else if (level >= 10) PET_CHICKEN
        else if (level >= 4) PET_CHICK
        else PET_EGG
    }

    fun get_achievement_points(ach_type: u8): u64 {
        if (ach_type == ACH_FIRST_GOAL)    return 30;
        if (ach_type == ACH_GOAL_COMPLETE) return 100;
        if (ach_type == ACH_STREAK_7)      return 50;
        if (ach_type == ACH_STREAK_30)     return 200;
        if (ach_type == ACH_BUDGET_MASTER) return 80;
        if (ach_type == ACH_DEFI_USER)     return 60;
        if (ach_type == ACH_PET_HATCH)     return 40;
        if (ach_type == ACH_PET_GROW)      return 80;
        0
    }

    // ===============================
    // Getters
    // ===============================
    public fun get_level(a: &RewardAccount): u64 { a.level }
    public fun get_xp(a: &RewardAccount): u64 { a.xp }
    public fun get_streak(a: &RewardAccount): u64 { a.streak_days }
    public fun get_points(a: &RewardAccount): u64 { a.points }
    public fun get_pet_stage(a: &RewardAccount): u8 { a.pet_stage }
    public fun has_badge(a: &RewardAccount, badge: u8): bool {
        vector::contains(&a.badges, &badge)
    }
    public fun xp_to_next_level(a: &RewardAccount): u64 {
        let threshold = a.level * XP_PER_LEVEL;
        if (a.xp >= threshold) 0 else threshold - a.xp
    }
}
