import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type Option = {
  label: string;
  value: string;
  image?: string; // <--- NUEVO: Campo opcional para la imagen
};

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Seleccionar...",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleUnselect = (item: string) => {
    onChange(selected.filter((i) => i !== item));
  };

  // Texto resumen para el botón
  const getButtonText = () => {
    if (selected.length === 0) return <span className="text-muted-foreground">{placeholder}</span>;
    if (selected.length === options.length) return "Todos seleccionados";
    if (selected.length === 1) return options.find((o) => o.value === selected[0])?.label;
    if (selected.length <= 2) {
      return selected.map((val) => options.find((o) => o.value === val)?.label).join(", ");
    }
    return `${selected.length} seleccionados`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between min-h-[2.5rem] h-auto", className)}
        >
          <div className="flex flex-wrap gap-1 items-center">
            {selected.length === 0 && <span className="text-muted-foreground font-normal truncate">{placeholder}</span>}
            {selected.length > 0 && (
              <>
                {selected.slice(0, 2).map((item) => {
                  const option = options.find((o) => o.value === item);
                  return (
                    <Badge
                      variant="secondary"
                      key={item}
                      className="mr-1 mb-1 flex items-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnselect(item);
                      }}
                    >
                      {/* Miniatura en el Badge seleccionado también */}
                      {option?.image && (
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={option.image} />
                          <AvatarFallback>{option.label[0]}</AvatarFallback>
                        </Avatar>
                      )}
                      {option?.label}
                      <button
                        className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleUnselect(item);
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleUnselect(item);
                        }}
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </Badge>
                  );
                })}
                {selected.length > 2 && (
                  <Badge variant="secondary" className="mr-1 mb-1">
                    +{selected.length - 2} más
                  </Badge>
                )}
              </>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList>
            <CommandEmpty>No se encontraron resultados.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    const isSelected = selected.includes(option.value);
                    if (isSelected) {
                      onChange(selected.filter((item) => item !== option.value));
                    } else {
                      onChange([...selected, option.value]);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    {/* Checkbox visual */}
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-sm border border-primary shrink-0",
                        selected.includes(option.value)
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible",
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </div>

                    {/* IMAGEN DEL PARTIDO/EQUIPO */}
                    <Avatar className="h-6 w-6 shrink-0">
                      {option.image ? <AvatarImage src={option.image} alt={option.label} /> : null}
                      <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                        {option.label.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <span className="truncate">{option.label}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
