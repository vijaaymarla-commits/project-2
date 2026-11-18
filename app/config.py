import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'fresh-cuts-secret-key-2026-meat-shop')
    JWT_SECRET = os.getenv('JWT_SECRET', 'fresh-cuts-jwt-secret-key-2026')
    
    # Supabase PostgreSQL parameters
    DB_HOST = os.getenv('DB_HOST', 'db.bxzjnzwmzixiyduaqvmf.supabase.co')
    DB_PORT = int(os.getenv('DB_PORT', 5432))
    DB_NAME = os.getenv('DB_NAME', 'postgres')
    DB_USER = os.getenv('DB_USER', 'postgres')
    DB_PASSWORD = os.getenv('DB_PASSWORD', 'Vijay@905980')
    DATABASE_URL = os.getenv('DATABASE_URL', f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}")
    
    SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://bxzjnzwmzixiyduaqvmf.supabase.co')
    SUPABASE_KEY = os.getenv('SUPABASE_KEY', '')
    SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
    
    DATA_MODE = os.getenv('DATA_MODE', 'supabase')
    PORT = int(os.getenv('PORT', 5000))
