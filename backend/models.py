from sqlalchemy import Column, Integer, String, Float
from .db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    contact = Column(String, nullable=False)
    account_number = Column(String, nullable=False)
    due_date = Column(String, nullable=False)

