"""
CRUD router for Recipes.
Prefix: /api/recipes  (set in main.py)
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app import models, schemas

router = APIRouter()


def _load(recipe_id: int, db: Session) -> models.Recipe:
    recipe = (
        db.query(models.Recipe)
        .options(joinedload(models.Recipe.ingredients))
        .filter(models.Recipe.id == recipe_id)
        .first()
    )
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    return recipe


@router.get("/", response_model=List[schemas.RecipeResponse])
def list_recipes(db: Session = Depends(get_db)):
    return (
        db.query(models.Recipe)
        .options(joinedload(models.Recipe.ingredients))
        .order_by(models.Recipe.title)
        .all()
    )


@router.get("/{recipe_id}", response_model=schemas.RecipeResponse)
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    return _load(recipe_id, db)


@router.post("/", response_model=schemas.RecipeResponse, status_code=status.HTTP_201_CREATED)
def create_recipe(body: schemas.RecipeCreate, db: Session = Depends(get_db)):
    recipe = models.Recipe(
        title=body.title,
        description=body.description,
        servings=body.servings,
        notes=body.notes,
    )
    db.add(recipe)
    db.flush()  # get recipe.id before adding ingredients

    for i, ing in enumerate(body.ingredients):
        db.add(models.RecipeIngredient(
            recipe_id=recipe.id,
            text=ing.text,
            position=ing.position if ing.position else i,
        ))

    db.commit()
    return _load(recipe.id, db)


@router.put("/{recipe_id}", response_model=schemas.RecipeResponse)
def update_recipe(recipe_id: int, body: schemas.RecipeCreate, db: Session = Depends(get_db)):
    recipe = _load(recipe_id, db)
    recipe.title = body.title
    recipe.description = body.description
    recipe.servings = body.servings
    recipe.notes = body.notes

    # Replace ingredients
    db.query(models.RecipeIngredient).filter(
        models.RecipeIngredient.recipe_id == recipe_id
    ).delete()
    for i, ing in enumerate(body.ingredients):
        db.add(models.RecipeIngredient(
            recipe_id=recipe_id,
            text=ing.text,
            position=ing.position if ing.position else i,
        ))

    db.commit()
    return _load(recipe_id, db)


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    db.delete(recipe)
    db.commit()
