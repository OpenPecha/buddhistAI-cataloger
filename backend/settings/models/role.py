from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base

class Role(Base):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str]
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"))

    tenant = relationship("Tenant", back_populates="roles")
    memberships = relationship("TenantMembership", back_populates="role")
