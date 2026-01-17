from typing import TypedDict

from pydantic import BaseModel, ConfigDict, Field


class BaseItemSource(BaseModel):
    """Base class for scraped items from Hoyolab"""

    entry_id: str
    name: str

    model_config = ConfigDict(extra="ignore")


class CharacterSource(BaseItemSource):
    """Source data for a character"""

    element: str
    rarity: int
    image_url: str


class EnrichedCharacterSource(CharacterSource):
    """Character data enriched with Fandom info"""

    weapon: str
    region: str
    release_date: str = Field(alias="releaseDate")


class ArtifactSource(BaseItemSource):
    """Source data for an artifact set"""

    image_urls: dict[str, str] = Field(default_factory=dict)
    effects: list[str] = Field(default_factory=list)


class WeaponSource(BaseItemSource):
    """Source data for a weapon"""

    rarity: int
    image_url: str
    type: str  # e.g. "Sword"
    secondary_stat: str
    effect: str
    base_atk: int
    secondary_stat_value: str


class ResourceOutput(BaseModel):
    """Output format for element/weapon-type resources"""

    name: str
    imageUrl: str
    imagePath: str


class MatchedItem[T: BaseItemSource](TypedDict):
    """Container for matched items across languages"""

    en: T
    zh: T


# I18n models for preprocess.py
class EffectData(BaseModel):
    en: list[str] = Field(default_factory=list)
    zh: list[str] = Field(default_factory=list)


class I18nArtifactData(BaseModel):
    name: dict[str, str] = Field(default_factory=dict)
    effects: EffectData


class HalfSet(BaseModel):
    id: int
    setIds: list[str]


# Final Output Models for JSON generation
class CharacterOutput(BaseModel):
    id: str
    element: str
    rarity: int
    weaponType: str
    region: str
    releaseDate: str
    imageUrl: str
    imagePath: str


class ArtifactOutput(BaseModel):
    id: str
    rarity: int
    imageUrl: str
    imagePaths: dict[str, str]


class WeaponOutput(BaseModel):
    id: str
    rarity: int
    type: str
    secondaryStat: str
    baseAtk: int
    secondaryStatValue: str
    imageUrl: str
    imagePath: str
