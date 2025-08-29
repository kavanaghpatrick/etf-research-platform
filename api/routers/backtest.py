"""
Backtesting router - placeholder for testing.
"""

from fastapi import APIRouter

router = APIRouter()

@router.get("/test")
async def test_backtest():
    return {"message": "Backtest router placeholder"}