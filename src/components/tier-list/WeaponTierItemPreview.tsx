import type { Weapon } from '@/data/types';
import { getAssetUrl } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { RARITY_COLORS } from '@/constants/theme';

interface WeaponTierItemPreviewProps {
  weapon: Weapon;
}

export const WeaponTierItemPreview = ({ weapon }: WeaponTierItemPreviewProps) => {
  const { t } = useLanguage();

  return (
    <div
      className={`w-16 h-16 rounded-md overflow-hidden relative ${RARITY_COLORS[weapon.rarity]}`}
      style={{
        opacity: 0.8,
        transform: 'scale(1.05)',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        cursor: 'grabbing',
      }}
    >
      <img
        src={getAssetUrl(weapon.imagePath)}
        alt={t.weaponName(weapon.id)}
        className="w-full h-full object-cover"
        draggable={false}
      />
    </div>
  );
};
