from pydantic import BaseModel, Field


class BacktestRequest(BaseModel):
    code: str = Field(pattern=r"^\d{6}$", description="6 位股票代码")
    strategy: str = Field(description="ma_cross | macd | kdj")
    params: dict = Field(default_factory=dict)
    start_date: str | None = Field(default=None, description="YYYY-MM-DD,缺省为全部历史")
    end_date: str | None = None
    initial_capital: float = 100_000.0
    fee_rate: float = Field(default=0.0, ge=0, le=0.01, description="单边费率,如 0.0003")
