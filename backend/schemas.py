from pydantic import BaseModel

class UserCreate(BaseModel):
    name: str
    email: str
    contact: str
    account_number: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    contact: str
    account_number: str
    due_date: str

    class Config:
        orm_mode = True
class OwnerLogin(BaseModel):
    username: str
    password: str
