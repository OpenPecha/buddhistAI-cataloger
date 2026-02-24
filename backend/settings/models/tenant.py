from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from core.database import Base

class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    domain: Mapped[str] = mapped_column(String, unique=True, index=True)
    brand_name: Mapped[str] = mapped_column(String, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    settings = relationship("TenantSettings", back_populates="tenant", uselist=False)
    memberships = relationship("TenantMembership", back_populates="tenant")
    roles = relationship("Role", back_populates="tenant")