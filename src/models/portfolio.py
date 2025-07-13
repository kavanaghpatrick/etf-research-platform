from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
import pandas as pd
import numpy as np


@dataclass
class Position:
    """Represents a position in a portfolio."""
    
    ticker: str
    shares: float
    average_cost: float
    current_price: Optional[float] = None
    
    @property
    def cost_basis(self) -> float:
        return self.shares * self.average_cost
    
    @property
    def market_value(self) -> float:
        if self.current_price is None:
            return self.cost_basis
        return self.shares * self.current_price
    
    @property
    def unrealized_pnl(self) -> float:
        if self.current_price is None:
            return 0.0
        return self.market_value - self.cost_basis
    
    @property
    def unrealized_pnl_pct(self) -> float:
        if self.cost_basis == 0:
            return 0.0
        return self.unrealized_pnl / self.cost_basis


@dataclass
class Portfolio:
    """Represents a portfolio of ETF positions."""
    
    name: str
    cash: float
    positions: Dict[str, Position] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    transactions: List = field(default_factory=list)
    
    @property
    def total_cost_basis(self) -> float:
        return sum(pos.cost_basis for pos in self.positions.values())
    
    @property
    def total_market_value(self) -> float:
        return sum(pos.market_value for pos in self.positions.values())
    
    @property
    def total_value(self) -> float:
        return self.cash + self.total_market_value
    
    @property
    def total_unrealized_pnl(self) -> float:
        return sum(pos.unrealized_pnl for pos in self.positions.values())
    
    def get_weights(self) -> Dict[str, float]:
        """Get portfolio weights based on market value."""
        total = self.total_value
        if total == 0:
            return {}
        
        weights = {}
        for ticker, position in self.positions.items():
            weights[ticker] = position.market_value / total
        
        weights["CASH"] = self.cash / total
        return weights
    
    def add_position(self, ticker: str, shares: float, price: float) -> None:
        """Add or update a position in the portfolio."""
        ticker = ticker.upper()
        
        if ticker in self.positions:
            existing = self.positions[ticker]
            total_shares = existing.shares + shares
            total_cost = existing.cost_basis + (shares * price)
            
            self.positions[ticker] = Position(
                ticker=ticker,
                shares=total_shares,
                average_cost=total_cost / total_shares if total_shares > 0 else 0,
                current_price=price
            )
        else:
            self.positions[ticker] = Position(
                ticker=ticker,
                shares=shares,
                average_cost=price,
                current_price=price
            )
        
        self.cash -= shares * price
    
    def remove_position(self, ticker: str, shares: float, price: float) -> float:
        """Remove shares from a position and return realized PnL."""
        ticker = ticker.upper()
        
        if ticker not in self.positions:
            raise ValueError(f"No position found for {ticker}")
        
        position = self.positions[ticker]
        
        if shares > position.shares:
            raise ValueError(f"Cannot sell {shares} shares. Only {position.shares} available.")
        
        realized_pnl = shares * (price - position.average_cost)
        
        if shares == position.shares:
            del self.positions[ticker]
        else:
            position.shares -= shares
        
        self.cash += shares * price
        
        return realized_pnl
    
    def update_prices(self, prices: Dict[str, float]) -> None:
        """Update current prices for all positions."""
        for ticker, position in self.positions.items():
            if ticker in prices:
                position.current_price = prices[ticker]
    
    def rebalance(self, target_weights: Dict[str, float], prices: Dict[str, float]) -> List[Dict]:
        """Rebalance portfolio to target weights."""
        self.update_prices(prices)
        
        current_value = self.total_value
        trades = []
        
        for ticker, target_weight in target_weights.items():
            if ticker == "CASH":
                continue
                
            target_value = current_value * target_weight
            current_value_in_ticker = 0
            
            if ticker in self.positions:
                current_value_in_ticker = self.positions[ticker].market_value
            
            diff_value = target_value - current_value_in_ticker
            
            if abs(diff_value) > 1:  # Minimum trade threshold
                shares = diff_value / prices[ticker]
                
                if shares > 0:
                    self.add_position(ticker, shares, prices[ticker])
                    trades.append({
                        "ticker": ticker,
                        "action": "BUY",
                        "shares": shares,
                        "price": prices[ticker]
                    })
                else:
                    shares_to_sell = min(-shares, self.positions[ticker].shares)
                    self.remove_position(ticker, shares_to_sell, prices[ticker])
                    trades.append({
                        "ticker": ticker,
                        "action": "SELL",
                        "shares": shares_to_sell,
                        "price": prices[ticker]
                    })
        
        return trades