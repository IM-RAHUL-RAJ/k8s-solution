BEGIN;

INSERT INTO clients
(
    client_ref,
    name,
    email,
    password_hash,
    phone,
    date_of_birth,
    gender,
    status
)
VALUES
(
    'C100000001',
    'Alice Johnson',
    'alice@example.com',
    'hash1',
    '0711111111',
    '1990-01-10',
    'FEMALE',
    'ACTIVE'
),
(
    'C100000002',
    'Bob Smith',
    'bob@example.com',
    'hash2',
    '0722222222',
    '1985-05-20',
    'MALE',
    'ACTIVE'
),
(
    'C100000003',
    'Charlie Brown',
    'charlie@example.com',
    'hash3',
    '0733333333',
    '1975-03-15',
    'MALE',
    'DORMANT'
),
(
    'C100000004',
    'Diana White',
    'diana@example.com',
    'hash4',
    '0744444444',
    '1988-08-08',
    'FEMALE',
    'ACTIVE'
),
(
    'C100000005',
    'Evan Taylor',
    'evan@example.com',
    'hash5',
    '0755555555',
    '1992-11-25',
    'OTHER',
    'CLOSED'
),
(
    'C100000006',
    'Fiona Green',
    'fiona@example.com',
    'hash6',
    NULL,
    NULL,
    'FEMALE',
    'ACTIVE'
);



-- ACTIVE EQUITY ACCOUNT

INSERT INTO accounts
(
    account_ref,
    client_id,
    account_type,
    currency,
    cash_balance,
    status,
    version
)
VALUES
(
    'ACC0000001',
    1,
    'EQUITY',
    'USD',
    10000.0000,
    'ACTIVE',
    0
);


-- SUSPENDED FOREX ACCOUNT

INSERT INTO accounts
(
    account_ref,
    client_id,
    account_type,
    currency,
    cash_balance,
    status,
    version,
    suspended_at
)
VALUES
(
    'ACC0000002',
    2,
    'FOREX',
    'USD',
    5000.0000,
    'SUSPENDED',
    0,
    '2026-01-10 10:00:00+00'
);


-- CLOSED CRYPTO ACCOUNT

INSERT INTO accounts
(
    account_ref,
    client_id,
    account_type,
    currency,
    cash_balance,
    status,
    version,
    closed_at
)
VALUES
(
    'ACC0000003',
    3,
    'CRYPTO',
    'USD',
    2000.0000,
    'CLOSED',
    0,
    '2026-02-01 12:00:00+00'
);


-- ACTIVE EQUITY LOW-CASH ACCOUNT

INSERT INTO accounts
(
    account_ref,
    client_id,
    account_type,
    currency,
    cash_balance,
    status,
    version
)
VALUES
(
    'ACC0000004',
    4,
    'EQUITY',
    'USD',
    50.0000,
    'ACTIVE',
    0
);


-- ACTIVE CRYPTO ACCOUNT

INSERT INTO accounts
(
    account_ref,
    client_id,
    account_type,
    currency,
    cash_balance,
    status,
    version
)
VALUES
(
    'ACC0000005',
    5,
    'CRYPTO',
    'EUR',
    7500.0000,
    'ACTIVE',
    0
);


-- ACTIVE FOREX ACCOUNT

INSERT INTO accounts
(
    account_ref,
    client_id,
    account_type,
    currency,
    cash_balance,
    status,
    version
)
VALUES
(
    'ACC0000006',
    6,
    'FOREX',
    'GBP',
    25000.0000,
    'ACTIVE',
    0
);


INSERT INTO account_preferences
(
    account_id,
    risk_profile,
    investment_goals,
    preferred_sectors
)
VALUES
(
    1,
    'MODERATE',
    'Long term growth',
    ARRAY['Technology', 'Healthcare']
),
(
    2,
    'CONSERVATIVE',
    'Capital preservation',
    ARRAY['Utilities', 'Consumer Staples']
),
(
    3,
    'CONSERVATIVE',
    'Retirement',
    ARRAY['Financials', 'Healthcare']
),
(
    4,
    'AGGRESSIVE',
    'Speculative trading',
    ARRAY['Technology', 'Financials']
),
(
    5,
    'AGGRESSIVE',
    'Crypto growth',
    ARRAY['Technology', 'Blockchain']
),
(
    6,
    'MODERATE',
    'Currency diversification',
    ARRAY['Financials', 'Technology']
);


-- PORTFOLIOS

INSERT INTO portfolios
(
    account_id,
    name,
    current_value
)
VALUES
(
    1,
    'Alice Portfolio',
    11000.0000
),
(
    2,
    'Bob Portfolio',
    2000.0000
),
(
    3,
    'Charlie Portfolio',
    1000.0000
),
(
    4,
    'Diana Portfolio',
    0.0000
),
(
    5,
    'Evan Portfolio',
    7500.0000
),
(
    6,
    'Fiona Portfolio',
    25000.0000
);


INSERT INTO instruments
(
    symbol,
    exchange,
    name,
    asset_class,
    currency,
    is_tradable,
    stopped_at
)
VALUES

-- US EQUITY

(
    'AAPL',
    'NYSE',
    'Apple Inc',
    'US_EQUITY',
    'USD',
    TRUE,
    NULL
),

(
    'MSFT',
    'NYSE',
    'Microsoft Corporation',
    'US_EQUITY',
    'USD',
    TRUE,
    NULL
),

(
    'TSLA',
    'NYSE',
    'Tesla Inc',
    'US_EQUITY',
    'USD',
    FALSE,
    '2026-03-15 10:00:00+00'
),


-- INDIAN EQUITY

(
    'INFY.NS',
    'NSE',
    'Infosys Limited',
    'INDIAN_EQUITY',
    'INR',
    TRUE,
    NULL
),

(
    'TCS.NS',
    'NSE',
    'Tata Consultancy Services',
    'INDIAN_EQUITY',
    'INR',
     TRUE,
    NULL
),

(
    'TATASTEEL.BO',
    'BSE',
    'Tata Steel Limited',
    'INDIAN_EQUITY',
    'INR',
    FALSE,
    '2026-02-10 10:00:00+00'
),


-- FOREX

(
    'EURUSD',
    'FX',
    'Euro / US Dollar',
    'FX',
    'USD',
    TRUE,
    NULL
),

(
    'GBPUSD',
    'FX',
    'British Pound / US Dollar',
    'FX',
    'USD',
    TRUE,
    NULL
),


-- CRYPTO

(
    'BTCUSD',
    'CRYPTO',
    'Bitcoin / US Dollar',
    'CRYPTO',
    'USD',
    TRUE,
    NULL
),

(
    'ETHUSD',
    'CRYPTO',
    'Ethereum / US Dollar',
    'CRYPTO',
    'USD',
    TRUE,
    NULL
);



INSERT INTO orders
(
    account_id,
    instrument_id,
    idempotency_key,
    order_type,
    quantity,
    price,
    status,
    created_at,
    terminal_at
)
VALUES
(
    1,
    1,
    'order-filled-aapl-buy-001',
    'BUY',
    10,
    150.00,
    'FILLED',
    '2026-01-01 09:30:00+00',
    '2026-01-01 09:30:05+00'
);


-- Transaction for ORDER 1

INSERT INTO transactions
(
    order_id,
    quantity,
    price,
    status,
    executed_at
)
VALUES
(
    1,
    10,
    150.00,
    'EXECUTED',
    '2026-01-01 09:30:05+00'
);


-- ORDER 2
-- NEW BUY INFY

INSERT INTO orders
(
    account_id,
    instrument_id,
    idempotency_key,
    order_type,
    quantity,
    price,
    status,
    created_at
)
VALUES
(
    1,
    3,
    'order-new-infy-buy-001',
    'BUY',
    20,
    1580.00,
    'NEW',
    '2026-02-01 10:00:00+00'
);


-- ORDER 3
-- REJECTED BUY

INSERT INTO orders
(
    account_id,
    instrument_id,
    idempotency_key,
    order_type,
    quantity,
    price,
    status,
    created_at,
    terminal_at
)
VALUES
(
    4,
    1,
    'order-rejected-aapl-buy-001',
    'BUY',
    100,
    500.00,
    'REJECTED',
    '2026-02-05 11:00:00+00',
    '2026-02-05 11:00:01+00'
);


-- Failed transaction for rejected order

INSERT INTO transactions
(
    order_id,
    quantity,
    price,
    status,
    executed_at
)
VALUES
(
    3,
    100,
    500.00,
    'FAILED',
    '2026-02-05 11:00:01+00'
);


-- ORDER 4
-- CANCELLED SELL

INSERT INTO orders
(
    account_id,
    instrument_id,
    idempotency_key,
    order_type,
    quantity,
    price,
    status,
    created_at,
    terminal_at
)
VALUES
(
    1,
    6,
    'order-cancelled-eurusd-sell-001',
    'SELL',
    5,
    1.1000,
    'CANCELLED',
    '2026-03-01 10:00:00+00',
    '2026-03-02 10:00:00+00'
);


-- ORDER 5
-- HISTORICAL FILLED BUY TATA STEEL - The instrument is now STOPPED.
-- The historical order is still valid.

INSERT INTO orders
(
    account_id,
    instrument_id,
    idempotency_key,
    order_type,
    quantity,
    price,
    status,
    created_at,
    terminal_at
)
VALUES
(
    1,
    5,
    'order-historical-tata-buy-001',
    'BUY',
    50,
    120.00,
    'FILLED',
    '2025-12-01 10:00:00+00',
    '2025-12-01 10:00:05+00'
);


-- Transaction for ORDER 5

INSERT INTO transactions
(
    order_id,
    quantity,
    price,
    status,
    executed_at
)
VALUES
(
    5,
    50,
    120.00,
    'EXECUTED',
    '2025-12-01 10:00:05+00'
);


-- ORDER 6
-- FILLED SELL AAPL

INSERT INTO orders
(
    account_id,
    instrument_id,
    idempotency_key,
    order_type,
    quantity,
    price,
    status,
    created_at,
    terminal_at
)
VALUES
(
    1,
    1,
    'order-filled-aapl-sell-001',
    'SELL',
    2,
    175.00,
    'FILLED',
    '2026-04-01 10:00:00+00',
    '2026-04-01 10:00:05+00'
);


-- Transaction for ORDER 6

INSERT INTO transactions
(
    order_id,
    quantity,
    price,
    status,
    executed_at
)
VALUES
(
    6,
    2,
    175.00,
    'EXECUTED',
    '2026-04-01 10:00:05+00'
);


-- ORDER 7
-- FILLED BUY ETH

INSERT INTO orders
(
    account_id,
    instrument_id,
    idempotency_key,
    order_type,
    quantity,
    price,
    status,
    created_at,
    terminal_at
)
VALUES
(
    5,
    9,
    'order-filled-eth-buy-001',
    'BUY',
    2,
    3000.00,
    'FILLED',
    '2026-04-10 12:00:00+00',
    '2026-04-10 12:00:05+00'
);


-- Transaction for ORDER 7

INSERT INTO transactions
(
    order_id,
    quantity,
    price,
    status,
    executed_at
)
VALUES
(
    7,
    2,
    3000.00,
    'EXECUTED',
    '2026-04-10 12:00:05+00'
);


-- ORDER 8
-- NEW SELL MSFT

INSERT INTO orders
(
    account_id,
    instrument_id,
    idempotency_key,
    order_type,
    quantity,
    price,
    status,
    created_at
)
VALUES
(
    6,
    2,
    'order-new-msft-sell-001',
    'SELL',
    5,
    450.00,
    'NEW',
    '2026-04-15 14:00:00+00'
);


-- ORDER 9
-- FILLED BUY TCS

INSERT INTO orders
(
    account_id,
    instrument_id,
    idempotency_key,
    order_type,
    quantity,
    price,
    status,
    created_at,
    terminal_at
)
VALUES
(
    6,
    4,
    'order-filled-tcs-buy-001',
    'BUY',
    15,
    3500.00,
    'FILLED',
    '2026-05-01 09:30:00+00',
    '2026-05-01 09:30:05+00'
);


-- Transaction for ORDER 9

INSERT INTO transactions
(
    order_id,
    quantity,
    price,
    status,
    executed_at
)
VALUES
(
    9,
    15,
    3500.00,
    'EXECUTED',
    '2026-05-01 09:30:05+00'
);


INSERT INTO portfolio_holdings
(
    portfolio_id,
    instrument_id,
    quantity,
    avg_price
)
VALUES
(
    1,
    1,
    8,
    150.00
);


INSERT INTO portfolio_holdings
(
    portfolio_id,
    instrument_id,
    quantity,
    avg_price
)
VALUES
(
    1,
    5,
    50,
    120.00
);


INSERT INTO portfolio_holdings
(
    portfolio_id,
    instrument_id,
    quantity,
    avg_price
)
VALUES
(
    5,
    9,
    2,
    3000.00
);


INSERT INTO portfolio_holdings
(
    portfolio_id,
    instrument_id,
    quantity,
    avg_price
)
VALUES
(
    6,
    4,
    15,
    3500.00
);


COMMIT;
