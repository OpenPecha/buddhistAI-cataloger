from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from core.database import Base

class TenantMembership(Base):
    __tablename__ = "tenant_member"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"))
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id"))
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="memberships")
    tenant = relationship("Tenant", back_populates="memberships")
    role = relationship("Role", back_populates="memberships")
