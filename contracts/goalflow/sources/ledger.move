/// GoalFlow — 帳本模組
///
/// 功能：
/// - 收支記錄（鏈上帳本）
/// - 收支分類定義
/// - 月曆資料索引
/// - 錢包交易對應記帳
module goalflow::ledger {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::string::String;
    use std::vector;
    use std::option::{Self, Option};

    // ===== 錯誤碼 =====
    const E_NOT_OWNER:      u64 = 3000;
    const E_ENTRY_NOT_FOUND: u64 = 3001;
    const E_INVALID_AMOUNT: u64 = 3002;

    // ===== 交易類別 =====
    // 收入
    const CAT_SALARY:      u8 = 0;
    const CAT_INVESTMENT:  u8 = 1;
    const CAT_BONUS:       u8 = 2;
    // 支出
    const CAT_FOOD:        u8 = 10;
    const CAT_TRANSPORT:   u8 = 11;
    const CAT_ENTERTAIN:   u8 = 12;
    const CAT_SHOPPING:    u8 = 13;
    const CAT_HEALTH:      u8 = 14;
    const CAT_UTILITIES:   u8 = 15;
    const CAT_GOAL:        u8 = 16;   // 目標存款
    const CAT_IMPULSE:     u8 = 17;   // 衝動消費
    const CAT_OTHER_EXP:   u8 = 18;

    // ===== 每日毫秒 =====
    const MS_PER_DAY: u64 = 86_400_000;

    // ===============================
    // 物件結構
    // ===============================

    /// 帳本條目
    struct LedgerEntry has store, copy, drop {
        entry_id: u64,
        amount: u64,             // 單位：前端顯示 NT$，鏈上 MIST
        is_income: bool,
        category: u8,
        note: String,
        timestamp_ms: u64,
        day_index: u64,          // timestamp_ms / MS_PER_DAY，方便按日查詢
        goal_id: Option<address>, // 連結的目標 (Option<ID 的地址表示>)
        tx_digest: Option<address>, // 鏈上交易 digest (如來自錢包轉帳)
        is_impulse_checked: bool,   // 是否經過冷靜期確認
    }

    /// 使用者帳本 (owned object)
    struct Ledger has key, store {
        id: UID,
        owner: address,
        entries: vector<LedgerEntry>,
        next_id: u64,
        total_income: u64,
        total_expense: u64,
        created_at: u64,
    }

    // ===============================
    // 事件
    // ===============================

    struct EntryAdded has copy, drop {
        owner: address,
        entry_id: u64,
        amount: u64,
        is_income: bool,
        category: u8,
        day_index: u64,
    }

    struct EntryDeleted has copy, drop {
        owner: address,
        entry_id: u64,
    }

    struct WalletTransactionRecorded has copy, drop {
        owner: address,
        entry_id: u64,
        amount: u64,
        is_income: bool,
        tx_digest: address,
    }

    // ===============================
    // Entry Functions
    // ===============================

    /// 建立帳本（Onboarding 時呼叫）
    public entry fun create_ledger(
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let ledger = Ledger {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            entries: vector::empty(),
            next_id: 1,
            total_income: 0,
            total_expense: 0,
            created_at: clock::timestamp_ms(clock),
        };
        transfer::transfer(ledger, tx_context::sender(ctx));
    }

    /// 新增收支條目
    /// 前端呼叫時機：手動記帳
    public entry fun add_entry(
        ledger: &mut Ledger,
        amount: u64,
        is_income: bool,
        category: u8,
        note: String,
        goal_id: Option<address>,
        is_impulse_checked: bool,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(ledger.owner == tx_context::sender(ctx), E_NOT_OWNER);
        assert!(amount > 0, E_INVALID_AMOUNT);

        let ts = clock::timestamp_ms(clock);
        let entry = LedgerEntry {
            entry_id: ledger.next_id,
            amount,
            is_income,
            category,
            note,
            timestamp_ms: ts,
            day_index: ts / MS_PER_DAY,
            goal_id,
            tx_digest: option::none(),
            is_impulse_checked,
        };

        if (is_income) {
            ledger.total_income = ledger.total_income + amount;
        } else {
            ledger.total_expense = ledger.total_expense + amount;
        };

        event::emit(EntryAdded {
            owner: ledger.owner,
            entry_id: ledger.next_id,
            amount,
            is_income,
            category,
            day_index: ts / MS_PER_DAY,
        });

        ledger.next_id = ledger.next_id + 1;
        vector::push_back(&mut ledger.entries, entry);
    }

    /// 刪除條目
    public entry fun delete_entry(
        ledger: &mut Ledger,
        entry_id: u64,
        ctx: &mut TxContext,
    ) {
        assert!(ledger.owner == tx_context::sender(ctx), E_NOT_OWNER);

        let i = 0;
        let len = vector::length(&ledger.entries);
        let found = false;
        while (i < len) {
            let e = vector::borrow(&ledger.entries, i);
            if (e.entry_id == entry_id) {
                if (e.is_income) {
                    ledger.total_income = ledger.total_income - e.amount;
                } else {
                    ledger.total_expense = ledger.total_expense - e.amount;
                };
                vector::remove(&mut ledger.entries, i);
                found = true;
                break
            };
            i = i + 1;
        };
        assert!(found, E_ENTRY_NOT_FOUND);

        event::emit(EntryDeleted { owner: ledger.owner, entry_id });
    }

    /// 記錄來自錢包的真實交易
    /// 前端呼叫時機：錢包轉帳後自動同步帳本
    public entry fun record_wallet_transaction(
        ledger: &mut Ledger,
        amount: u64,
        is_income: bool,
        category: u8,
        note: String,
        tx_digest: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(ledger.owner == tx_context::sender(ctx), E_NOT_OWNER);
        assert!(amount > 0, E_INVALID_AMOUNT);

        let ts = clock::timestamp_ms(clock);
        let entry = LedgerEntry {
            entry_id: ledger.next_id,
            amount,
            is_income,
            category,
            note,
            timestamp_ms: ts,
            day_index: ts / MS_PER_DAY,
            goal_id: option::none(),
            tx_digest: option::some(tx_digest),
            is_impulse_checked: true,
        };

        if (is_income) {
            ledger.total_income = ledger.total_income + amount;
        } else {
            ledger.total_expense = ledger.total_expense + amount;
        };

        event::emit(WalletTransactionRecorded {
            owner: ledger.owner,
            entry_id: ledger.next_id,
            amount,
            is_income,
            tx_digest,
        });

        ledger.next_id = ledger.next_id + 1;
        vector::push_back(&mut ledger.entries, entry);
    }

    // ===============================
    // Getters
    // ===============================

    public fun get_totals(ledger: &Ledger): (u64, u64) {
        (ledger.total_income, ledger.total_expense)
    }

    public fun get_net(ledger: &Ledger): (bool, u64) {
        if (ledger.total_income >= ledger.total_expense) {
            (true, ledger.total_income - ledger.total_expense)
        } else {
            (false, ledger.total_expense - ledger.total_income)
        }
    }

    public fun count_entries(ledger: &Ledger): u64 {
        vector::length(&ledger.entries)
    }
}
