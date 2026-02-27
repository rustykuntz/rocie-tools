---
name: aviation-weather
description: Fetch airport weather (METAR, TAF, PIREPs) for flight planning and briefings. Use for "weather at KJFK", "TAF for EGLL", or pre-flight weather checks.
metadata:
  homepage: https://aviationweather.gov/
---

# Aviation Weather

Fetch real-time aviation weather from the FAA's aviationweather.gov API.

## Quick Reference

```bash
# METAR for specific airports
python3 ./wx.py KSMO KLAX KVNY

# METAR + TAF
python3 ./wx.py KSMO KLAX --metar --taf

# Just TAF
python3 ./wx.py KSMO --taf

# PIREPs near a location (lat/lon)
python3 ./wx.py --pirep --lat 34.0 --lon -118.4 --radius 100

# Raw output with JSON
python3 ./wx.py KSMO --json

# Verbose (show raw METAR text)
python3 ./wx.py KSMO -v
```

## Default Airports

When no stations specified, defaults to Santa Monica area: `KSMO`, `KLAX`, `KVNY`

## Flight Categories

- 🟢 VFR - Ceiling >3000ft AGL and visibility >5sm
- 🔵 MVFR - Ceiling 1000-3000ft or visibility 3-5sm
- 🔴 IFR - Ceiling 500-1000ft or visibility 1-3sm
- 🟣 LIFR - Ceiling <500ft or visibility <1sm

## Common SoCal Airports

| Code | Name |
|------|------|
| KSMO | Santa Monica |
| KLAX | Los Angeles Intl |
| KVNY | Van Nuys |
| KBUR | Burbank |
| KTOA | Torrance |
| KSNA | John Wayne |
| KFUL | Fullerton |
| KCMA | Camarillo |
| KOXR | Oxnard |
| KPSP | Palm Springs |

## Options

- `--metar`, `-m`: Fetch METAR (default)
- `--taf`, `-t`: Fetch TAF forecast
- `--pirep`, `-p`: Fetch pilot reports
- `--hours N`: Hours of METAR history (default: 2)
- `--lat`, `--lon`: Location for PIREP search
- `--radius N`: PIREP search radius in nm (default: 100)
- `--verbose`, `-v`: Show raw observation text
- `--json`: Output raw JSON data
