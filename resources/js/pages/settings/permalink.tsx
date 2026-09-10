import { Form, Head } from '@inertiajs/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as permalinkActions from '@/actions/App/Http/Controllers/PermalinkController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Preset = { key: string; structure: string; sample: string };

interface Props {
    structure: string;
    preset: string;
    categoryBase: string;
    tagBase: string;
    presets: Preset[];
    tags: string[];
}

const PRESET_LABELS: Record<string, string> = {
    plain: '朴素',
    day: '日期和名称型',
    month: '月份和名称型',
    numeric: '数字型',
    postname: '文章名',
    custom: '自定义结构',
};

export default function Permalink({ structure, preset, categoryBase, tagBase, presets, tags }: Props) {
    const { t } = useTranslation();
    const [choice, setChoice] = useState(preset);
    const [customStructure, setCustomStructure] = useState(preset === 'custom' ? structure : '');

    const insertTag = (tag: string) => {
        setChoice('custom');
        setCustomStructure((prev) => {
            const base = prev || '/';
            return base.replace(/\/?$/, '') + '/' + tag.replace(/^\/?|\/?$/g, '') + '/';
        });
    };

    return (
        <>
            <Head title={t('settings.permalink.title')} />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="space-y-6">
                    <Heading
                        variant="small"
                        title={t('settings.permalink.heading')}
                        description={t('settings.permalink.description')}
                    />

                    <Form
                        {...permalinkActions.update.form()}
                        options={{ preserveScroll: true }}
                        className="space-y-10"
                    >
                        {({ processing, errors }) => (
                            <>
                                <input type="hidden" name="preset" value={choice} />
                                <input type="hidden" name="custom_structure" value={customStructure} />

                                {/* 常用设置 */}
                                <div className="space-y-5">
                                    <h3 className="text-base font-medium">{t('settings.permalink.common')}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        选择您的站点所要使用的固定链接结构。纳入{' '}
                                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">%postname%</code>{' '}
                                        标签能让链接更容易理解，也能帮助您的文章在搜索引擎中有更好的排名。
                                    </p>

                                    <div className="space-y-1">
                                        {presets.map((item) => (
                                            <label
                                                key={item.key}
                                                className={cn(
                                                    'flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60',
                                                    choice === item.key && 'bg-muted/60',
                                                )}
                                            >
                                                <input
                                                    type="radio"
                                                    name="preset_choice"
                                                    value={item.key}
                                                    checked={choice === item.key}
                                                    onChange={() => setChoice(item.key)}
                                                    className="mt-1 accent-primary"
                                                />
                                                <div>
                                                    <span className="text-sm font-medium">{PRESET_LABELS[item.key] ?? item.key}</span>
                                                    <code className="mt-1 block rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground font-mono">
                                                        {item.sample}
                                                    </code>
                                                </div>
                                            </label>
                                        ))}

                                        {/* 自定义结构 */}
                                        <label
                                            className={cn(
                                                'flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60',
                                                choice === 'custom' && 'bg-muted/60',
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="preset_choice"
                                                value="custom"
                                                checked={choice === 'custom'}
                                                onChange={() => setChoice('custom')}
                                                className="mt-1 accent-primary"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <span className="text-sm font-medium">{PRESET_LABELS.custom}</span>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground font-mono">
                                                        {t('settings.permalink.siteUrl')}
                                                    </span>
                                                    <Input
                                                        value={customStructure}
                                                        onChange={(e) => setCustomStructure(e.target.value)}
                                                        onFocus={() => setChoice('custom')}
                                                        placeholder="/%postname%/"
                                                        className="font-mono text-sm"
                                                    />
                                                </div>
                                                {choice === 'custom' && (
                                                    <div className="mt-3">
                                                        <p className="mb-2 text-sm text-muted-foreground">{t('settings.permalink.availableTags')}</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {tags.map((tag) => (
                                                                <button
                                                                    key={tag}
                                                                    type="button"
                                                                    onClick={() => insertTag(tag)}
                                                                    className="rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1.5 text-xs font-mono transition-colors hover:border-primary/50 hover:bg-accent hover:text-accent-foreground"
                                                                >
                                                                    {tag}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <InputError className="mt-2" message={errors.custom_structure} />
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* 可选 */}
                                <div className="space-y-5">
                                    <h3 className="text-base font-medium">{t('settings.permalink.optional')}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {t('settings.permalink.optionalDescription')}
                                    </p>

                                    <div className="grid gap-2">
                                        <Label htmlFor="category_base">{t('settings.permalink.categoryBase')}</Label>
                                        <Input
                                            id="category_base"
                                            name="category_base"
                                            defaultValue={categoryBase}
                                            placeholder="category"
                                            className="max-w-xs font-mono"
                                        />
                                        <InputError className="mt-2" message={errors.category_base} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="tag_base">{t('settings.permalink.tagBase')}</Label>
                                        <Input
                                            id="tag_base"
                                            name="tag_base"
                                            defaultValue={tagBase}
                                            placeholder="tag"
                                            className="max-w-xs font-mono"
                                        />
                                        <InputError className="mt-2" message={errors.tag_base} />
                                    </div>
                                </div>

                                <Button type="submit" disabled={processing}>
                                    {t('settings.permalink.save')}
                                </Button>
                            </>
                        )}
                    </Form>
                </div>
            </div>
        </>
    );
}
