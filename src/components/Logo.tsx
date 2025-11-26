export const Logo = () => {
  return (
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shadow-elevated">
        <span className="text-primary-foreground font-display font-bold text-xl">Q</span>
      </div>
      <span className="font-display font-bold text-2xl text-foreground">QUORUM</span>
    </div>
  );
};
