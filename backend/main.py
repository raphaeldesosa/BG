# backend/main.py

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
from dateutil.relativedelta import relativedelta

from backend import models, schemas
from backend.db import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="PAY APP API")

# CORS (allow Flutter frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change to frontend URL if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database session dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Owner login (authentication)
OWNER_USERNAME = "admin"
OWNER_PASSWORD = "payapp123"

@app.post("/owner/login")
def owner_login(login: schemas.OwnerLogin):
    if login.username == OWNER_USERNAME and login.password == OWNER_PASSWORD:
        return {"message": "Login successful"}
    raise HTTPException(status_code=401, detail="Invalid credentials")

# Add user info (borrower info)
@app.post("/users", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    due_date = datetime.today() + relativedelta(months=2)

    db_user = models.User(
        name=user.name,
        email=user.email,
        contact=user.contact,
        account_number=user.account_number,
        due_date=due_date.strftime("%Y-%m-%d"),
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# Get all users (admin only)
@app.get("/users", response_model=list[schemas.UserResponse])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()

# Delete a user by ID (admin only)
@app.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": f"User {user.name} deleted successfully"}
