#!/usr/bin/env python3
import argparse
import json
import os
import sys
from datetime import date, datetime
from typing import Any, List, Optional


def _error(message: str, **extra: Any) -> int:
    payload = {"error": message}
    payload.update({k: v for k, v in extra.items() if v is not None})
    sys.stderr.write(json.dumps(payload) + "\n")
    return 1


def _require_env(name: str) -> str:
    value = str(os.environ.get(name, "")).strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    v = value.strip()
    if not v:
        return None
    if v.endswith("Z"):
        v = v[:-1] + "+00:00"
    return datetime.fromisoformat(v)


def _parse_symbols(value: str) -> List[str]:
    items = [part.strip().upper() for part in str(value or "").split(",")]
    out = [x for x in items if x]
    if not out:
        raise ValueError("At least one symbol is required")
    return out


def _parse_timeframe(value: str):
    from alpaca.data.timeframe import TimeFrame, TimeFrameUnit

    s = str(value or "").strip().lower()
    mapping = {
        "1min": TimeFrame(1, TimeFrameUnit.Minute),
        "5min": TimeFrame(5, TimeFrameUnit.Minute),
        "15min": TimeFrame(15, TimeFrameUnit.Minute),
        "30min": TimeFrame(30, TimeFrameUnit.Minute),
        "1hour": TimeFrame(1, TimeFrameUnit.Hour),
        "1day": TimeFrame.Day,
        "1week": TimeFrame.Week,
        "1month": TimeFrame.Month,
    }
    if s not in mapping:
        raise ValueError("Unsupported timeframe. Use one of: 1Min,5Min,15Min,30Min,1Hour,1Day,1Week,1Month")
    return mapping[s]


def _to_jsonable(obj: Any) -> Any:
    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {str(k): _to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [_to_jsonable(v) for v in obj]
    if hasattr(obj, "model_dump"):
        try:
            return _to_jsonable(obj.model_dump())
        except Exception:
            pass
    if hasattr(obj, "dict"):
        try:
            return _to_jsonable(obj.dict())
        except Exception:
            pass
    if hasattr(obj, "__dict__"):
        data = {}
        for k, v in vars(obj).items():
            if not str(k).startswith("_"):
                data[k] = _to_jsonable(v)
        if data:
            return data
    return str(obj)


def _build_client():
    from alpaca.data.historical import StockHistoricalDataClient

    key_id = _require_env("APCA_API_KEY_ID")
    secret_key = _require_env("APCA_API_SECRET_KEY")
    raw_data = str(os.environ.get("APCA_RAW_DATA", "")).strip().lower() in {"1", "true", "yes", "on"}
    try:
        return StockHistoricalDataClient(key_id, secret_key, raw_data=raw_data)
    except TypeError:
        return StockHistoricalDataClient(key_id, secret_key)


def cmd_latest_quote(args: argparse.Namespace) -> int:
    from alpaca.data.requests import StockLatestQuoteRequest

    client = _build_client()
    req = StockLatestQuoteRequest(symbol_or_symbols=args.symbol.upper())
    result = client.get_stock_latest_quote(req)
    sys.stdout.write(json.dumps(_to_jsonable(result)) + "\n")
    return 0


def cmd_bars(args: argparse.Namespace) -> int:
    from alpaca.data.requests import StockBarsRequest

    client = _build_client()
    symbols = _parse_symbols(args.symbols)
    req = StockBarsRequest(
        symbol_or_symbols=symbols,
        timeframe=_parse_timeframe(args.timeframe),
        limit=args.limit,
        start=_parse_iso(args.start),
        end=_parse_iso(args.end),
    )
    result = client.get_stock_bars(req)
    sys.stdout.write(json.dumps(_to_jsonable(result)) + "\n")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="alpaca-market-data", description="Minimal Alpaca Market Data CLI for Rocie")
    sub = p.add_subparsers(dest="command")
    sub.required = True

    q = sub.add_parser("latest-quote", help="Get latest stock quote for one symbol")
    q.add_argument("--symbol", required=True, help="Ticker symbol, e.g. AAPL")
    q.set_defaults(func=cmd_latest_quote)

    b = sub.add_parser("bars", help="Get historical stock bars for one or more symbols")
    b.add_argument("--symbols", required=True, help="Comma-separated symbols, e.g. AAPL,MSFT")
    b.add_argument("--timeframe", default="1Day", help="1Min,5Min,15Min,30Min,1Hour,1Day,1Week,1Month")
    b.add_argument("--limit", type=int, default=10, help="Max bars per symbol")
    b.add_argument("--start", help="ISO datetime, e.g. 2026-02-24T14:30:00Z")
    b.add_argument("--end", help="ISO datetime, e.g. 2026-02-24T21:00:00Z")
    b.set_defaults(func=cmd_bars)

    return p


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
        return int(args.func(args))
    except KeyboardInterrupt:
        return _error("Interrupted")
    except Exception as exc:
        return _error(str(exc), type=exc.__class__.__name__)


if __name__ == "__main__":
    raise SystemExit(main())
