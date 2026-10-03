import { LiquidSwitch } from '@/components/LiquidGlass/LiquidSwitch';
import { Switch } from '@/components/ui/switch';
import { EFFECT_LEVEL, useEffectsAtLeast } from '@/hooks/use-effects';

/**
 * 状态快捷开关：特效达到「开启」档时渲染液态玻璃开关，否则渲染普通开关。
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
    const liquidSwitch = useEffectsAtLeast(EFFECT_LEVEL.on);

    if (liquidSwitch) {
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
