from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.auth_context import RequestUser
from app.planning import schemas, models


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _require_name(value: str | None, field_name: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field_name} is required")
    return cleaned


def create_budget(db: Session, current_user: RequestUser, payload: schemas.BudgetCreate) -> models.Budget:
    db_item = models.Budget(
        user_id=current_user.id,
        category_ids=_clean_optional_text(payload.category_ids),
        name=_clean_optional_text(payload.name),
        amount=payload.amount,
        cycle=payload.cycle,
        start_date=payload.start_date,
        end_date=payload.end_date,
        threshold=payload.threshold,
        status="active"
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def list_budgets(db: Session, current_user: RequestUser) -> list[models.Budget]:
    return db.query(models.Budget).filter(models.Budget.user_id == current_user.id).all()

def update_budget(db: Session, current_user: RequestUser, budget_id: int, payload: schemas.BudgetUpdate) -> models.Budget:
    db_item = db.query(models.Budget).filter(models.Budget.id == budget_id, models.Budget.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No budget changes provided")
    if "name" in data:
        data["name"] = _clean_optional_text(data.get("name"))
    if "category_ids" in data:
        data["category_ids"] = _clean_optional_text(data.get("category_ids"))
    for key, value in data.items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

def delete_budget(db: Session, current_user: RequestUser, budget_id: int) -> None:
    db_item = db.query(models.Budget).filter(models.Budget.id == budget_id, models.Budget.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
    db.delete(db_item)
    db.commit()

def create_goal(db: Session, current_user: RequestUser, payload: schemas.GoalCreate) -> models.Goal:
    db_item = models.Goal(
        user_id=current_user.id,
        name=_require_name(payload.name, "Goal name"),
        target_amount=payload.target_amount,
        target_date=payload.target_date,
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def list_goals(db: Session, current_user: RequestUser) -> list[models.Goal]:
    return db.query(models.Goal).filter(models.Goal.user_id == current_user.id).all()

def update_goal(db: Session, current_user: RequestUser, goal_id: int, payload: schemas.GoalUpdate) -> models.Goal:
    db_item = db.query(models.Goal).filter(models.Goal.id == goal_id, models.Goal.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No goal changes provided")
    if "name" in data and isinstance(data["name"], str):
        data["name"] = _require_name(data["name"], "Goal name")
        
    for key, value in data.items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

def delete_goal(db: Session, current_user: RequestUser, goal_id: int) -> None:
    db_item = db.query(models.Goal).filter(models.Goal.id == goal_id, models.Goal.user_id == current_user.id).first()
    if not db_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Goal not found")
    db.delete(db_item)
    db.commit()
