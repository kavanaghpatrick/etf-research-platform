"""
Smart error handler for expected vs unexpected errors in data fetching.
Suppresses noisy logging for expected failures while preserving important errors.
"""

import logging
from typing import Dict, Set, Optional, Tuple
from datetime import datetime, date
import re

class SmartErrorHandler:
    """
    Intelligent error handler that classifies and filters errors.
    """
    
    # Expected error patterns that should be suppressed or logged at DEBUG level
    EXPECTED_ERROR_PATTERNS = [
        # Holiday/weekend fetches from YFinance
        (r"possibly delisted.*no price data found.*\d{4}-\d{2}-\d{2}", logging.DEBUG),
        (r"No data returned for \w+ on non-trading day", logging.DEBUG),
        
        # Rate limits (log as warning, not error)
        (r"Rate limit", logging.WARNING),
        (r"429 error", logging.WARNING),
        (r"too many.*requests", logging.WARNING),
        
        # Polygon free tier limitations
        (r"Your plan doesn't include this data timeframe", logging.INFO),
        (r"NOT_AUTHORIZED.*timeframe", logging.INFO),
        
        # Known API limitations
        (r"No data found for ticker on holiday", logging.DEBUG),
        (r"Market closed on", logging.DEBUG),
        
        # Connection/timeout issues (temporary)
        (r"Connection.*timed out", logging.WARNING),
        (r"Max retries exceeded", logging.WARNING),
    ]
    
    def __init__(self):
        self.suppressed_errors: Dict[str, int] = {}
        self.error_counts: Dict[str, int] = {}
        
    def should_log_error(self, error_message: str, source: str = None) -> Tuple[bool, int]:
        """
        Determine if an error should be logged and at what level.
        
        Args:
            error_message: The error message to check
            source: Optional source of the error (e.g., 'YFinance', 'Polygon')
            
        Returns:
            Tuple of (should_log, log_level)
        """
        # Check if this matches any expected error pattern
        for pattern, level in self.EXPECTED_ERROR_PATTERNS:
            if re.search(pattern, error_message, re.IGNORECASE):
                return (True, level)
        
        # If not an expected error, log as ERROR
        return (True, logging.ERROR)
    
    def handle_error(self, logger: logging.Logger, error_message: str, 
                    source: str = None, ticker: str = None, date_range: str = None):
        """
        Smart error handling with context-aware logging.
        
        Args:
            logger: Logger instance to use
            error_message: Error message
            source: Data source that generated the error
            ticker: Ticker symbol (if applicable)
            date_range: Date range being fetched (if applicable)
        """
        # Build context string
        context_parts = []
        if source:
            context_parts.append(f"Source: {source}")
        if ticker:
            context_parts.append(f"Ticker: {ticker}")
        if date_range:
            context_parts.append(f"Range: {date_range}")
        
        context = " | ".join(context_parts) if context_parts else ""
        full_message = f"{error_message} [{context}]" if context else error_message
        
        # Determine if and how to log
        should_log, log_level = self.should_log_error(error_message, source)
        
        if should_log:
            if log_level == logging.DEBUG:
                logger.debug(full_message)
            elif log_level == logging.INFO:
                logger.info(full_message)
            elif log_level == logging.WARNING:
                logger.warning(full_message)
            else:
                logger.error(full_message)
        
        # Track error counts for monitoring
        error_key = f"{source}:{error_message[:50]}"
        self.error_counts[error_key] = self.error_counts.get(error_key, 0) + 1
    
    def get_error_summary(self) -> Dict[str, any]:
        """
        Get a summary of errors for monitoring.
        
        Returns:
            Dictionary with error statistics
        """
        return {
            'total_errors': sum(self.error_counts.values()),
            'unique_errors': len(self.error_counts),
            'top_errors': sorted(
                [(k, v) for k, v in self.error_counts.items()],
                key=lambda x: x[1],
                reverse=True
            )[:10]
        }


# Global error handler instance
error_handler = SmartErrorHandler()


def configure_logging(log_level: str = 'INFO', suppress_expected_errors: bool = True):
    """
    Configure logging with smart error suppression.
    
    Args:
        log_level: Base log level (INFO, WARNING, ERROR, DEBUG)
        suppress_expected_errors: Whether to suppress expected errors
    """
    # Configure root logger
    logging.basicConfig(
        level=getattr(logging, log_level.upper()),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Suppress noisy loggers
    if suppress_expected_errors:
        # YFinance errors for non-trading days
        logging.getLogger('yfinance').setLevel(logging.WARNING)
        
        # Reduce noise from HTTP libraries
        logging.getLogger('urllib3').setLevel(logging.WARNING)
        logging.getLogger('requests').setLevel(logging.WARNING)
        
        # Suppress expected source errors
        logging.getLogger('simple_data_sources').addFilter(ExpectedErrorFilter())
        logging.getLogger('yfinance_source').addFilter(ExpectedErrorFilter())


class ExpectedErrorFilter(logging.Filter):
    """
    Custom logging filter to suppress expected errors.
    """
    
    def filter(self, record):
        """
        Filter out expected error messages.
        
        Args:
            record: LogRecord to filter
            
        Returns:
            True if record should be logged, False to suppress
        """
        # Get the error message
        message = record.getMessage()
        
        # Check against expected patterns
        for pattern, expected_level in SmartErrorHandler.EXPECTED_ERROR_PATTERNS:
            if re.search(pattern, message, re.IGNORECASE):
                # If it's an expected error at DEBUG level, suppress it unless we're in DEBUG mode
                if expected_level == logging.DEBUG and record.levelno > logging.DEBUG:
                    return False
                # Otherwise, downgrade the level
                elif record.levelno > expected_level:
                    record.levelno = expected_level
                    record.levelname = logging.getLevelName(expected_level)
        
        return True