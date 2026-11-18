import os
import psycopg2
import hashlib
from app.config import Config

def init_supabase_database():
    print(f"Connecting to Supabase PostgreSQL at {Config.DB_HOST}...")
    conn = psycopg2.connect(
        host=Config.DB_HOST,
        port=Config.DB_PORT,
        dbname=Config.DB_NAME,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        connect_timeout=15
    )
    cur = conn.cursor()

    # Read and run schema.sql
    schema_path = os.path.join(os.path.dirname(__file__), 'supabase', 'schema.sql')
    with open(schema_path, 'r', encoding='utf-8') as f:
        schema_sql = f.read()

    print("Applying schema.sql to Supabase...")
    cur.execute(schema_sql)
    conn.commit()
    print("Schema applied successfully!")

    # Check if profiles exist
    cur.execute("SELECT COUNT(*) FROM public.profiles;")
    cnt = cur.fetchone()[0]
    if cnt == 0:
        print("Seeding initial data into Supabase...")
        seed_path = os.path.join(os.path.dirname(__file__), 'supabase', 'seed.sql')
        with open(seed_path, 'r', encoding='utf-8') as f:
            seed_sql = f.read()
        cur.execute(seed_sql)
        conn.commit()
        
        # Set passwords for default users: admin123, emp123
        pwd_admin = hashlib.sha256("admin123".encode()).hexdigest()
        pwd_emp = hashlib.sha256("emp123".encode()).hexdigest()
        cur.execute("UPDATE public.profiles SET password_hash = %s WHERE role = 'admin';", (pwd_admin,))
        cur.execute("UPDATE public.profiles SET password_hash = %s WHERE role = 'employee';", (pwd_emp,))
        conn.commit()
        print("Seed data & demo accounts successfully initialized in Supabase!")
    else:
        print(f"Database already contains {cnt} profiles. Skipping seed insertion.")

    cur.close()
    conn.close()
    print("Supabase database setup is complete.")

if __name__ == '__main__':
    init_supabase_database()
