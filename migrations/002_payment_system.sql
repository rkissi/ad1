-- Payment System Database Schema
-- Enterprise-grade payment and transaction management

-- ==================== PAYMENT CUSTOMERS ====================
CREATE TABLE IF NOT EXISTS payment_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_did VARCHAR(255) UNIQUE NOT NULL REFERENCES users(did) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(255) UNIQUE,
    default_payment_method VARCHAR(255),
    billing_email VARCHAR(255),
    billing_address JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_customers_user_did ON payment_customers(user_did);
CREATE INDEX idx_payment_customers_stripe_id ON payment_customers(stripe_customer_id);

-- ==================== PAYMENT INTENTS ====================
CREATE TABLE IF NOT EXISTS payment_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    customer_id UUID REFERENCES payment_customers(id) ON DELETE SET NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'usd',
    status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(255),
    client_secret TEXT,
    metadata JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP
);

CREATE INDEX idx_payment_intents_customer ON payment_intents(customer_id);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);
CREATE INDEX idx_payment_intents_stripe_id ON payment_intents(stripe_payment_intent_id);

-- ==================== SUBSCRIPTIONS ====================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_subscription_id VARCHAR(255) UNIQUE,
    customer_id UUID REFERENCES payment_customers(id) ON DELETE CASCADE,
    plan_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'usd',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);

-- ==================== PAYMENT METHODS ====================
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_payment_method_id VARCHAR(255) UNIQUE NOT NULL,
    customer_id UUID REFERENCES payment_customers(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    card_brand VARCHAR(50),
    card_last4 VARCHAR(4),
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    is_default BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_methods_customer ON payment_methods(customer_id);
CREATE INDEX idx_payment_methods_stripe_id ON payment_methods(stripe_payment_method_id);

-- ==================== INVOICES ====================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_invoice_id VARCHAR(255) UNIQUE,
    customer_id UUID REFERENCES payment_customers(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    amount_due DECIMAL(15, 2) NOT NULL,
    amount_paid DECIMAL(15, 2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'usd',
    status VARCHAR(50) DEFAULT 'draft',
    due_date TIMESTAMP,
    paid_at TIMESTAMP,
    invoice_pdf TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_stripe_id ON invoices(stripe_invoice_id);

-- ==================== REFUNDS ====================
CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_refund_id VARCHAR(255) UNIQUE,
    payment_intent_id UUID REFERENCES payment_intents(id) ON DELETE SET NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'usd',
    reason VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

CREATE INDEX idx_refunds_payment_intent ON refunds(payment_intent_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_stripe_id ON refunds(stripe_refund_id);

-- ==================== PAYOUTS ====================
CREATE TABLE IF NOT EXISTS platform_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_did VARCHAR(255) REFERENCES users(did) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'usd',
    destination_type VARCHAR(50) NOT NULL,
    destination_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending',
    stripe_payout_id VARCHAR(255),
    blockchain_tx_hash VARCHAR(66),
    metadata JSONB DEFAULT '{}',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_message TEXT
);

CREATE INDEX idx_platform_payouts_user ON platform_payouts(user_did);
CREATE INDEX idx_platform_payouts_status ON platform_payouts(status);
CREATE INDEX idx_platform_payouts_stripe_id ON platform_payouts(stripe_payout_id);

-- ==================== WALLET BALANCES ====================
CREATE TABLE IF NOT EXISTS wallet_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_did VARCHAR(255) UNIQUE REFERENCES users(did) ON DELETE CASCADE,
    available_balance DECIMAL(18, 6) DEFAULT 0,
    pending_balance DECIMAL(18, 6) DEFAULT 0,
    total_earned DECIMAL(18, 6) DEFAULT 0,
    total_withdrawn DECIMAL(18, 6) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'usd',
    last_payout_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallet_balances_user ON wallet_balances(user_did);

-- ==================== PAYMENT TRANSACTIONS ====================
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_did VARCHAR(255) REFERENCES users(did) ON DELETE SET NULL,
    type VARCHAR(100) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'usd',
    status VARCHAR(50) DEFAULT 'pending',
    payment_intent_id UUID REFERENCES payment_intents(id) ON DELETE SET NULL,
    campaign_id VARCHAR(255) REFERENCES campaigns(id) ON DELETE SET NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_payment_transactions_user ON payment_transactions(user_did);
CREATE INDEX idx_payment_transactions_type ON payment_transactions(type);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX idx_payment_transactions_campaign ON payment_transactions(campaign_id);
CREATE INDEX idx_payment_transactions_created_at ON payment_transactions(created_at DESC);

-- ==================== WEBHOOK EVENTS ====================
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_events_provider ON webhook_events(provider);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);

-- ==================== ADMIN ACTIONS LOG ====================
CREATE TABLE IF NOT EXISTS admin_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_did VARCHAR(255) REFERENCES users(did) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    target_type VARCHAR(100) NOT NULL,
    target_id VARCHAR(255) NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_actions_admin ON admin_actions(admin_did);
CREATE INDEX idx_admin_actions_type ON admin_actions(action_type);
CREATE INDEX idx_admin_actions_target ON admin_actions(target_type, target_id);
CREATE INDEX idx_admin_actions_created_at ON admin_actions(created_at DESC);

-- ==================== TRIGGERS ====================

CREATE OR REPLACE FUNCTION update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'succeeded' AND OLD.status != 'succeeded' THEN
        IF NEW.type IN ('ad_impression', 'ad_click', 'ad_conversion', 'publisher_revenue') THEN
            UPDATE wallet_balances
            SET available_balance = available_balance + NEW.amount,
                total_earned = total_earned + NEW.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_did = NEW.user_did;
        ELSIF NEW.type = 'payout' THEN
            UPDATE wallet_balances
            SET available_balance = available_balance - NEW.amount,
                total_withdrawn = total_withdrawn + NEW.amount,
                last_payout_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_did = NEW.user_did;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_wallet_balance
AFTER UPDATE ON payment_transactions
FOR EACH ROW
EXECUTE FUNCTION update_wallet_balance();

-- ==================== VIEWS ====================

CREATE OR REPLACE VIEW payment_analytics AS
SELECT
    DATE(created_at) as date,
    COUNT(*) as total_transactions,
    SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) as successful_transactions,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_transactions,
    SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as total_revenue,
    AVG(CASE WHEN status = 'succeeded' THEN amount ELSE NULL END) as avg_transaction_value
FROM payment_transactions
GROUP BY DATE(created_at)
ORDER BY date DESC;

CREATE OR REPLACE VIEW user_payment_summary AS
SELECT
    u.did,
    u.email,
    u.display_name,
    COALESCE(wb.available_balance, 0) as available_balance,
    COALESCE(wb.total_earned, 0) as total_earned,
    COALESCE(wb.total_withdrawn, 0) as total_withdrawn,
    COUNT(DISTINCT pt.id) as total_transactions,
    COUNT(DISTINCT s.id) as active_subscriptions
FROM users u
LEFT JOIN wallet_balances wb ON u.did = wb.user_did
LEFT JOIN payment_transactions pt ON u.did = pt.user_did
LEFT JOIN payment_customers pc ON u.did = pc.user_did
LEFT JOIN subscriptions s ON pc.id = s.customer_id AND s.status = 'active'
GROUP BY u.did, u.email, u.display_name, wb.available_balance, wb.total_earned, wb.total_withdrawn;

-- ==================== FUNCTIONS ====================

CREATE OR REPLACE FUNCTION get_payment_stats(period_days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_revenue DECIMAL,
    total_transactions BIGINT,
    avg_transaction_value DECIMAL,
    success_rate DECIMAL,
    refund_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE WHEN pt.status = 'succeeded' THEN pt.amount ELSE 0 END), 0) as total_revenue,
        COUNT(pt.id) as total_transactions,
        COALESCE(AVG(CASE WHEN pt.status = 'succeeded' THEN pt.amount ELSE NULL END), 0) as avg_transaction_value,
        COALESCE(
            (COUNT(CASE WHEN pt.status = 'succeeded' THEN 1 END)::DECIMAL / NULLIF(COUNT(pt.id), 0)) * 100,
            0
        ) as success_rate,
        COALESCE(
            (COUNT(r.id)::DECIMAL / NULLIF(COUNT(pt.id), 0)) * 100,
            0
        ) as refund_rate
    FROM payment_transactions pt
    LEFT JOIN payment_intents pi ON pt.payment_intent_id = pi.id
    LEFT JOIN refunds r ON pi.id = r.payment_intent_id
    WHERE pt.created_at >= CURRENT_TIMESTAMP - (period_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO metaverse_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO metaverse_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO metaverse_user;
