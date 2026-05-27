"""
CRUD router for CustomLists and ListItems.
Prefix: /api/lists  (set in main.py)
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app import models, schemas

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper: fetch a list or 404
# ---------------------------------------------------------------------------
def _get_list_or_404(list_id: int, db: Session) -> models.CustomList:
    lst = (
        db.query(models.CustomList)
        .options(selectinload(models.CustomList.items))
        .filter(models.CustomList.id == list_id)
        .first()
    )
    if not lst:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
    return lst


# ---------------------------------------------------------------------------
# Helper: fetch an item or 404 (also validates it belongs to the list)
# ---------------------------------------------------------------------------
def _get_item_or_404(list_id: int, item_id: int, db: Session) -> models.ListItem:
    item = (
        db.query(models.ListItem)
        .filter(models.ListItem.id == item_id, models.ListItem.list_id == list_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


# ---------------------------------------------------------------------------
# GET /  — list all custom lists (items ordered by position ascending)
# ---------------------------------------------------------------------------
@router.get("/", response_model=List[schemas.CustomListResponse])
def list_all(db: Session = Depends(get_db)):
    lists = (
        db.query(models.CustomList)
        .options(selectinload(models.CustomList.items))
        .order_by(models.CustomList.created_at)
        .all()
    )
    # Sort items by position in Python to ensure correct ordering
    for lst in lists:
        lst.items.sort(key=lambda i: i.position)
    return lists


# ---------------------------------------------------------------------------
# POST /  — create a new list
# ---------------------------------------------------------------------------
@router.post("/", response_model=schemas.CustomListResponse, status_code=status.HTTP_201_CREATED)
def create_list(body: schemas.CustomListCreate, db: Session = Depends(get_db)):
    lst = models.CustomList(name=body.name, colour=body.colour)
    db.add(lst)
    db.commit()
    db.refresh(lst)
    return lst


# ---------------------------------------------------------------------------
# PUT /{list_id}  — update list name or colour
# ---------------------------------------------------------------------------
@router.put("/{list_id}", response_model=schemas.CustomListResponse)
def update_list(list_id: int, body: schemas.CustomListCreate, db: Session = Depends(get_db)):
    lst = _get_list_or_404(list_id, db)
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lst, field, value)
    db.commit()
    db.refresh(lst)
    # Re-sort items after refresh
    lst.items.sort(key=lambda i: i.position)
    return lst


# ---------------------------------------------------------------------------
# PATCH /{list_id}  — partial update list name or colour (frontend uses PATCH)
# ---------------------------------------------------------------------------
@router.patch("/{list_id}", response_model=schemas.CustomListResponse)
def patch_list(list_id: int, body: schemas.CustomListUpdate, db: Session = Depends(get_db)):
    lst = _get_list_or_404(list_id, db)
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lst, field, value)
    db.commit()
    db.refresh(lst)
    lst.items.sort(key=lambda i: i.position)
    return lst


# ---------------------------------------------------------------------------
# DELETE /{list_id}  — delete list + cascade delete all items
# ---------------------------------------------------------------------------
@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list(list_id: int, db: Session = Depends(get_db)):
    lst = _get_list_or_404(list_id, db)
    db.delete(lst)
    db.commit()


# ---------------------------------------------------------------------------
# POST /{list_id}/items  — add an item to a list
# ---------------------------------------------------------------------------
@router.post(
    "/{list_id}/items",
    response_model=schemas.ListItemResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_item(list_id: int, body: schemas.ListItemCreate, db: Session = Depends(get_db)):
    # Verify the list exists
    _get_list_or_404(list_id, db)

    # Auto-assign position = max(existing positions) + 1
    max_pos = (
        db.query(func.max(models.ListItem.position))
        .filter(models.ListItem.list_id == list_id)
        .scalar()
    )
    next_position = (max_pos or 0) + 1

    item = models.ListItem(
        list_id=list_id,
        text=body.text,
        checked=body.checked,
        position=next_position,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# ---------------------------------------------------------------------------
# PUT /{list_id}/items/{item_id}  — update item text or checked state
# ---------------------------------------------------------------------------
@router.put("/{list_id}/items/{item_id}", response_model=schemas.ListItemResponse)
def update_item(
    list_id: int,
    item_id: int,
    body: schemas.ListItemCreate,
    db: Session = Depends(get_db),
):
    item = _get_item_or_404(list_id, item_id, db)
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


# ---------------------------------------------------------------------------
# PATCH /{list_id}/items/{item_id}  — partial update (frontend uses PATCH)
# ---------------------------------------------------------------------------
@router.patch("/{list_id}/items/{item_id}", response_model=schemas.ListItemResponse)
def patch_item(
    list_id: int,
    item_id: int,
    body: schemas.ListItemUpdate,
    db: Session = Depends(get_db),
):
    item = _get_item_or_404(list_id, item_id, db)
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


# ---------------------------------------------------------------------------
# DELETE /{list_id}/items/{item_id}  — delete a single item
# ---------------------------------------------------------------------------
@router.delete("/{list_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(list_id: int, item_id: int, db: Session = Depends(get_db)):
    item = _get_item_or_404(list_id, item_id, db)
    db.delete(item)
    db.commit()


# ---------------------------------------------------------------------------
# POST /{list_id}/items/clear-checked  — delete all checked items in a list
# NOTE: This route MUST be declared before /{list_id}/items/{item_id} so that
#       "clear-checked" is not mistakenly parsed as an item_id.
# ---------------------------------------------------------------------------
@router.post("/{list_id}/items/clear-checked", status_code=status.HTTP_204_NO_CONTENT)
def clear_checked_items(list_id: int, db: Session = Depends(get_db)):
    # Verify the list exists
    _get_list_or_404(list_id, db)

    db.query(models.ListItem).filter(
        models.ListItem.list_id == list_id,
        models.ListItem.checked == True,  # noqa: E712
    ).delete(synchronize_session=False)
    db.commit()
