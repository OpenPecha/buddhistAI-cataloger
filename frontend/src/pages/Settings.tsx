import { useState, useEffect } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  updateTenant, 
  getTenantSettings, 
  updateTenantSettings,
  createTenantSettings,
  createTenant
} from '@/api/settings';
import { useGetSettingsByDomain } from '@/hooks/useSettings';

function Settings() {
  const domain = globalThis.location.hostname;
  const { data: tenantData, isLoading, error, refetch } = useGetSettingsByDomain(domain);
  
  const [saving, setSaving] = useState(false);
  const [creatingTenant, setCreatingTenant] = useState(false);
  
  // Form state
  const [domainValue, setDomainValue] = useState(domain);
  const [brandName, setBrandName] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');

  // Prefill form when tenantData is loaded
  useEffect(() => {
    if (tenantData) {
      setDomainValue(tenantData.domain);
      setBrandName(tenantData.brand_name);
      
      // If settings exist in the response, use them
      if (tenantData.settings) {
        setIconUrl(tenantData.settings.brand_icon_url || '');
        setPrimaryColor(tenantData.settings.brand_primary_color || '');
        setSecondaryColor(tenantData.settings.brand_secondary_color || '');
      } else {
        // Otherwise, fetch settings separately
        loadSettings(tenantData.id);
      }
    }
  }, [tenantData]);

  const loadSettings = async (tenantId: string) => {
    const settingsData = await getTenantSettings(tenantId);
    if (settingsData) {
      setIconUrl(settingsData.brand_icon_url || '');
      setPrimaryColor(settingsData.brand_primary_color || '');
      setSecondaryColor(settingsData.brand_secondary_color || '');
    }
    // If settings don't exist, they will be created on save
  };

  const handleCreateTenant = async () => {
    try {
      setCreatingTenant(true);
      const newTenant = await createTenant({
        domain: domainValue.trim(),
        brand_name: brandName.trim() || domainValue.trim(),
      });
      
      if (newTenant) {
        toast.success('Tenant created successfully');
        // Refetch to get the new tenant data
        await refetch();
      }
    } catch (error) {
      console.error('Error creating tenant:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create tenant';
      toast.error(errorMessage);
    } finally {
      setCreatingTenant(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tenantData) {
      // If tenant doesn't exist, create it first
      await handleCreateTenant();
      return;
    }

    try {
      setSaving(true);

      // Update tenant
      const updatedTenant = await updateTenant(tenantData.id, {
        domain: domainValue.trim(),
        brand_name: brandName.trim(),
      });

      if (updatedTenant) {
        // Refetch to get updated data
        await refetch();
      }

      // Get current settings to check if they exist
      const currentSettings = await getTenantSettings(tenantData.id).catch(() => null);

      // Update or create tenant settings
      const settingsUpdate = {
        brand_icon_url: iconUrl.trim() || null,
        brand_primary_color: primaryColor.trim() || null,
        brand_secondary_color: secondaryColor.trim() || null,
      };

      if (currentSettings) {
        // Update existing settings
        await updateTenantSettings(tenantData.id, settingsUpdate);
      } else {
        // Create new settings
        await createTenantSettings(tenantData.id, settingsUpdate);
      }

      // Refetch to get updated settings
      await refetch();
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-16 max-w-4xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            <p className="text-gray-500 mt-4">Loading settings...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If tenant doesn't exist, show form to create it
  if (!tenantData && error) {
    return (
      <div className="container mx-auto py-16 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create Tenant</CardTitle>
            <CardDescription>
              No tenant found for this domain. Create a new tenant to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateTenant(); }} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="domain">
                  Domain <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="domain"
                  type="text"
                  value={domainValue}
                  onChange={(e) => setDomainValue(e.target.value)}
                  placeholder="example.com"
                  required
                  disabled
                />
                <p className="text-sm text-gray-500">
                  The domain name for this tenant
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brandName">
                  Brand Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="brandName"
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="My Brand"
                  required
                  disabled={creatingTenant}
                />
                <p className="text-sm text-gray-500">
                  The display name for your brand
                </p>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={creatingTenant}>
                  {creatingTenant ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Tenant'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-16 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Settings</CardTitle>
          <CardDescription>
            Configure your brand name, icon, and color settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Domain */}
            <div className="space-y-2">
              <Label htmlFor="domain">
                Domain <span className="text-red-500">*</span>
              </Label>
              <Input
                id="domain"
                type="text"
                value={domainValue}
                onChange={(e) => setDomainValue(e.target.value)}
                placeholder="example.com"
                required
                disabled={true}
              />
              <p className="text-sm text-gray-500">
                The domain name for this tenant
              </p>
            </div>

            {/* Brand Name */}
            <div className="space-y-2">
              <Label htmlFor="brandName">
                Brand Name / Domain Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="brandName"
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="My Brand"
                required
                disabled={saving}
              />
              <p className="text-sm text-gray-500">
                The display name for your brand
              </p>
            </div>

            {/* Icon URL */}
            <div className="space-y-2">
              <Label htmlFor="iconUrl">Icon URL</Label>
              <Input
                id="iconUrl"
                type="url"
                value={iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                placeholder="https://example.com/icon.png"
                disabled={saving}
              />
              <p className="text-sm text-gray-500">
                URL to your brand icon image
              </p>
              {iconUrl && (
                <div className="mt-2">
                  <img 
                    src={iconUrl} 
                    alt="Brand icon preview" 
                    className="h-16 w-16 object-contain border rounded"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            {/* Primary Color */}
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primaryColor"
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#3B82F6"
                  disabled={saving}
                  className="flex-1"
                />
                <Input
                  type="color"
                  value={primaryColor || '#3B82F6'}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  disabled={saving}
                  className="w-20 h-9 cursor-pointer"
                />
              </div>
              <p className="text-sm text-gray-500">
                Primary brand color (hex code)
              </p>
              {primaryColor && (
                <div 
                  className="mt-2 h-8 w-full rounded border"
                  style={{ backgroundColor: primaryColor }}
                />
              )}
            </div>

            {/* Secondary Color */}
            <div className="space-y-2">
              <Label htmlFor="secondaryColor">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="secondaryColor"
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  placeholder="#10B981"
                  disabled={saving}
                  className="flex-1"
                />
                <Input
                  type="color"
                  value={secondaryColor || '#10B981'}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  disabled={saving}
                  className="w-20 h-9 cursor-pointer"
                />
              </div>
              <p className="text-sm text-gray-500">
                Secondary brand color (hex code)
              </p>
              {secondaryColor && (
                <div 
                  className="mt-2 h-8 w-full rounded border"
                  style={{ backgroundColor: secondaryColor }}
                />
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default Settings;
