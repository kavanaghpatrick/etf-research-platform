-- ETF Research Platform Database Schema
-- PostgreSQL + TimescaleDB for time series optimization

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Ticker metadata table
CREATE TABLE tickers (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(255),
    sector VARCHAR(100),
    exchange VARCHAR(10),
    first_cached_date DATE,
    last_cached_date DATE,
    total_records INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Main time series table (will become hypertable)
CREATE TABLE stock_data (
    ticker_symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    open DECIMAL(12,4) NOT NULL,
    high DECIMAL(12,4) NOT NULL,
    low DECIMAL(12,4) NOT NULL,
    close DECIMAL(12,4) NOT NULL,
    volume BIGINT NOT NULL,
    adj_close DECIMAL(12,4) NOT NULL,
    source VARCHAR(50) NOT NULL,
    fetch_timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (ticker_symbol, date)
);

-- Convert to TimescaleDB hypertable (partitioned by time)
SELECT create_hypertable('stock_data', 'date', 
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

-- Cache coverage tracking table
CREATE TABLE cache_ranges (
    id SERIAL PRIMARY KEY,
    ticker_symbol VARCHAR(10) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    source VARCHAR(50) NOT NULL,
    record_count INT NOT NULL,
    is_complete BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (ticker_symbol) REFERENCES tickers(symbol) ON DELETE CASCADE
);

-- API usage tracking
CREATE TABLE api_usage (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    endpoint VARCHAR(100),
    ticker_symbol VARCHAR(10),
    request_timestamp TIMESTAMPTZ DEFAULT NOW(),
    response_time_ms INT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    records_fetched INT DEFAULT 0
);

-- Cache statistics view
CREATE VIEW cache_stats AS
SELECT 
    t.symbol,
    t.name,
    t.total_records,
    t.first_cached_date,
    t.last_cached_date,
    COALESCE(cr.range_count, 0) as cached_ranges,
    CASE 
        WHEN t.last_cached_date >= CURRENT_DATE - 1 THEN 'Current'
        WHEN t.last_cached_date >= CURRENT_DATE - 7 THEN 'Recent' 
        ELSE 'Stale'
    END as freshness_status
FROM tickers t
LEFT JOIN (
    SELECT ticker_symbol, COUNT(*) as range_count 
    FROM cache_ranges 
    GROUP BY ticker_symbol
) cr ON t.symbol = cr.ticker_symbol;

-- Indexes for performance
CREATE INDEX idx_stock_data_ticker_date ON stock_data (ticker_symbol, date DESC);
CREATE INDEX idx_stock_data_date ON stock_data (date DESC);
CREATE INDEX idx_cache_ranges_ticker ON cache_ranges (ticker_symbol);
CREATE INDEX idx_cache_ranges_dates ON cache_ranges (start_date, end_date);
CREATE INDEX idx_api_usage_timestamp ON api_usage (request_timestamp DESC);
CREATE INDEX idx_api_usage_source ON api_usage (source, request_timestamp DESC);

-- Compression policy (compress data older than 7 days)
SELECT add_compression_policy('stock_data', INTERVAL '7 days');

-- Retention policy (keep data for 10 years)
SELECT add_retention_policy('stock_data', INTERVAL '10 years');

-- Functions for cache management

-- Function to get missing date ranges for a ticker
CREATE OR REPLACE FUNCTION get_missing_ranges(
    p_ticker VARCHAR(10), 
    p_start_date DATE, 
    p_end_date DATE
) RETURNS TABLE(start_date DATE, end_date DATE) AS $$
DECLARE
    current_date DATE := p_start_date;
    last_cached_date DATE;
    gap_start DATE;
BEGIN
    -- Skip weekends by using a business day calendar
    WHILE current_date <= p_end_date LOOP
        -- Skip weekends
        IF EXTRACT(DOW FROM current_date) NOT IN (0, 6) THEN
            -- Check if this date exists in cache
            SELECT MAX(date) INTO last_cached_date 
            FROM stock_data 
            WHERE ticker_symbol = p_ticker 
            AND date <= current_date;
            
            -- If no data found or gap detected
            IF last_cached_date IS NULL OR last_cached_date < current_date THEN
                gap_start := current_date;
                
                -- Find end of gap
                WHILE current_date <= p_end_date 
                    AND EXTRACT(DOW FROM current_date) NOT IN (0, 6)
                    AND NOT EXISTS (
                        SELECT 1 FROM stock_data 
                        WHERE ticker_symbol = p_ticker 
                        AND date = current_date
                    ) LOOP
                    current_date := current_date + 1;
                END LOOP;
                
                -- Return gap range
                RETURN QUERY SELECT gap_start, current_date - 1;
            END IF;
        END IF;
        
        current_date := current_date + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to update ticker metadata after cache insert
CREATE OR REPLACE FUNCTION update_ticker_metadata() 
RETURNS TRIGGER AS $$
BEGIN
    -- Update ticker record count and date ranges
    UPDATE tickers SET
        total_records = (
            SELECT COUNT(*) FROM stock_data 
            WHERE ticker_symbol = NEW.ticker_symbol
        ),
        first_cached_date = (
            SELECT MIN(date) FROM stock_data 
            WHERE ticker_symbol = NEW.ticker_symbol
        ),
        last_cached_date = (
            SELECT MAX(date) FROM stock_data 
            WHERE ticker_symbol = NEW.ticker_symbol
        ),
        updated_at = NOW()
    WHERE symbol = NEW.ticker_symbol;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update metadata
CREATE TRIGGER update_ticker_metadata_trigger
    AFTER INSERT OR UPDATE OR DELETE ON stock_data
    FOR EACH ROW EXECUTE FUNCTION update_ticker_metadata();

-- Insert some initial ticker symbols
INSERT INTO tickers (symbol, name, sector) VALUES 
('AAPL', 'Apple Inc.', 'Technology'),
('SPY', 'SPDR S&P 500 ETF Trust', 'ETF'),
('QQQ', 'Invesco QQQ Trust', 'ETF'),
('VTI', 'Vanguard Total Stock Market ETF', 'ETF'),
('MSFT', 'Microsoft Corporation', 'Technology'),
('GOOGL', 'Alphabet Inc.', 'Technology'),
('TSLA', 'Tesla Inc.', 'Automotive'),
('NVDA', 'NVIDIA Corporation', 'Technology'),
('META', 'Meta Platforms Inc.', 'Technology'),
('AMZN', 'Amazon.com Inc.', 'Technology')
ON CONFLICT (symbol) DO NOTHING;