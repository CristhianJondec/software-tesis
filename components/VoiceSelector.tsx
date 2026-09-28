'use client';

import React from 'react';
import { voiceOptions, type VoiceKey } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { VoiceSelectorProps } from '@/types';

// Female first: it is the default voice.
const VOICE_ORDER: VoiceKey[] = ['camila', 'alex'];

const VoiceSelector = ({ value, onChange, disabled, className }: VoiceSelectorProps) => {
    return (
        <RadioGroup
            value={value}
            onValueChange={onChange}
            disabled={disabled}
            className={cn('voice-selector-options', className)}
        >
            {VOICE_ORDER.map((voiceKey) => {
                const voice = voiceOptions[voiceKey];
                const isSelected = value === voiceKey;
                return (
                    <Label
                        key={voiceKey}
                        className={cn(
                            'voice-selector-option',
                            isSelected ? 'voice-selector-option-selected' : 'voice-selector-option-default',
                            disabled && 'voice-selector-option-disabled'
                        )}
                    >
                        <RadioGroupItem value={voiceKey} id={voiceKey} className="sr-only" />
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <div className={cn(
                                    "w-4 h-4 rounded-full border flex items-center justify-center",
                                    isSelected ? "border-[#663820]" : "border-gray-300"
                                )}>
                                    {isSelected && <div className="w-2 h-2 rounded-full bg-[#663820]" />}
                                </div>
                                <span className="font-bold text-[#212a3b]">
                                    {voice.gender === 'female' ? 'Femenina' : 'Masculina'} ({voice.name})
                                </span>
                            </div>
                            <p className="text-xs text-[#777] leading-relaxed">
                                {voice.description}
                            </p>
                        </div>
                    </Label>
                );
            })}
        </RadioGroup>
    );
};

export default VoiceSelector;
