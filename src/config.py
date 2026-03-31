from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = f"sqlite:///{BASE_DIR / 'data' / 'business_ops.db'}"
DATA_DIR = BASE_DIR / "data"
REPORTS_DIR = BASE_DIR / "reports"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
REPORTS_DIR.mkdir(exist_ok=True)

# Engineer info
ENGINEER_NAME = "Hamood Al Adhari"
ENGINEER_TITLE = "Senior Quality Management Engineer"
COMPANY = "Oman Broadband"
