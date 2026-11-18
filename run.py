import os
from app import create_app
from app.config import Config

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"==================================================")
    print(f"  FRESH CUT MEAT SHOP MANAGEMENT SYSTEM v1.1      ")
    print(f"  Running on: http://127.0.0.1:{port}             ")
    print(f"  Backend: Flask REST API + Supabase PostgreSQL   ")
    print(f"==================================================")
    app.run(host='0.0.0.0', port=port, debug=True)
