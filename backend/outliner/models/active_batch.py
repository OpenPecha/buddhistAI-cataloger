
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base

class ActiveBatch(Base):

    __tablename__ = "active_batch"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(String, nullable=False, unique=True)
