from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class TransactionType(Enum):
    BUY = "BUY"
    SELL = "SELL"
    DIVIDEND = "DIVIDEND"
    FEE = "FEE"
    DEPOSIT = "DEPOSIT"
    WITHDRAWAL = "WITHDRAWAL"


@dataclass
class Transaction:
    """Represents a transaction in the portfolio."""
    
    timestamp: datetime
    transaction_type: TransactionType
    ticker: str
    shares: float
    price: float
    commission: float = 0.0
    notes: str = ""
    
    @property
    def gross_amount(self) -> float:
        """Gross transaction amount before commission."""
        if self.transaction_type in [TransactionType.BUY, TransactionType.SELL]:
            return self.shares * self.price
        return self.price  # For deposits, withdrawals, etc.
    
    @property
    def net_amount(self) -> float:
        """Net transaction amount after commission."""
        if self.transaction_type == TransactionType.BUY:
            return -(self.gross_amount + self.commission)
        elif self.transaction_type == TransactionType.SELL:
            return self.gross_amount - self.commission
        elif self.transaction_type == TransactionType.DEPOSIT:
            return self.gross_amount
        elif self.transaction_type == TransactionType.WITHDRAWAL:
            return -self.gross_amount
        elif self.transaction_type == TransactionType.FEE:
            return -self.commission
        else:
            return self.gross_amount