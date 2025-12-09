import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Filter, ListOrdered, Sword } from 'lucide-react';
import { ToolHeader } from '@/components/shared/ToolHeader';
import { useLanguage } from '@/contexts/LanguageContext';

const Home = () => {
  const { t } = useLanguage();

  return (
    <div className="h-screen flex flex-col bg-gradient-mystical text-foreground overflow-auto">
      <ToolHeader title="" />
      
      <div className="flex-1 container mx-auto px-4 py-12 flex flex-col items-center justify-center gap-12">
        {/* Hero Section */}
        <div className="text-center space-y-6 max-w-3xl">
          <h1 className="text-5xl md:text-6xl font-bold text-transparent bg-gradient-golden bg-clip-text drop-shadow-sm pb-2">
            {t.ui('app.title')}
          </h1>
          <p className="text-xl text-muted-foreground">
            {t.ui('app.heroDescription')}
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid md:grid-cols-3 gap-8 w-full max-w-6xl">
          {/* Artifact Filter Card */}
          <Card className="bg-card/40 backdrop-blur-md border-border/50 hover:bg-card/60 transition-colors group cursor-pointer h-full">
            <Link to="/artifact-filter" className="block h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl text-primary group-hover:text-primary/80 transition-colors">
                  <Filter className="w-8 h-8" />
                  {t.ui('app.artifactFilterTitle')}
                </CardTitle>
                <CardDescription className="text-base mt-3">
                  {t.ui('app.artifactFilterWhat')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground/90 italic leading-relaxed">
                  {t.ui('app.artifactFilterWhy')}
                </p>
              </CardContent>
            </Link>
          </Card>

          {/* Tier List Card */}
          <Card className="bg-card/40 backdrop-blur-md border-border/50 hover:bg-card/60 transition-colors group cursor-pointer h-full">
            <Link to="/tier-list" className="block h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl text-primary group-hover:text-primary/80 transition-colors">
                  <ListOrdered className="w-8 h-8" />
                  {t.ui('app.tierListTitle')}
                </CardTitle>
                <CardDescription className="text-base mt-3">
                  {t.ui('app.tierListWhat')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground/90 italic leading-relaxed">
                  {t.ui('app.tierListWhy')}
                </p>
              </CardContent>
            </Link>
          </Card>

          {/* Weapon Tier List Card */}
          <Card className="bg-card/40 backdrop-blur-md border-border/50 hover:bg-card/60 transition-colors group cursor-pointer h-full">
            <Link to="/weapon-tier-list" className="block h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-2xl text-primary group-hover:text-primary/80 transition-colors">
                  <Sword className="w-8 h-8" />
                  {t.ui('app.weaponTierListTitle')}
                </CardTitle>
                <CardDescription className="text-base mt-3">
                  {t.ui('app.weaponTierListWhat')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground/90 italic leading-relaxed">
                  {t.ui('app.weaponTierListWhy')}
                </p>
              </CardContent>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Home;