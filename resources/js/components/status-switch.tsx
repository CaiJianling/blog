import { LiquidSwitch } from '@/components/LiquidGlass/LiquidSwitch';
import { Switch } from '@/components/ui/switch';
import { useEffects } from '@/hooks/use-effects';

/**
 * 状态快捷开关：开启特效时渲染液态玻璃开关，否则渲染普通开关。
 */
export default function StatusSwitch({
    checked,
    onCheckedChange,
    disabled,
}: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
}) {
    const { effectsEnabled } = useEffects();

    if (effectsEnabled) {
        return (
            <LiquidSwitch
                checked={checked}
                onChange={onCheckedChange}
                size="sm"
                disabled={disabled}
            />
        );
    }

    return (
        <Switch
            checked={checked}
            onCheckedChange={onCheckedChange}
            disabled={disabled}
        />
    );
}
