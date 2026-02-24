from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base


class TenantSettings(Base):
    __tablename__ = "tenant_settings"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), unique=True)
    brand_icon_url: Mapped[str | None] = mapped_column(String, nullable=True)
    brand_primary_color: Mapped[str | None] = mapped_column(String, nullable=True)
    brand_secondary_color: Mapped[str | None] = mapped_column(String, nullable=True)

    tenant = relationship("Tenant", back_populates="settings")
