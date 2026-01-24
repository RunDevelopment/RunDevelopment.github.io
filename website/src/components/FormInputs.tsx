"use client";

import { useEffect, useState } from "react";

interface NumberInputProps {
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    readOnly?: boolean;
    className?: string;
    name?: string;
    id?: string;
}
export function NumberInput({
    value,
    onChange,
    min,
    max,
    readOnly,
    className,
    name,
    id,
}: NumberInputProps) {
    const [text, setText] = useState(value.toString());

    useEffect(() => {
        setText(value.toString());
    }, [value]);

    const commit = (): void => {
        if (readOnly) return;

        const newValue = parseInt(text, 10);
        if (Number.isNaN(newValue)) {
            // reset
            setText(value.toString());
        } else {
            const clamped = Math.min(Math.max(newValue, min), max);
            onChange(clamped);
            setText(clamped.toString());
        }
    };

    return (
        <input
            id={id}
            name={name}
            type="number"
            className={
                (className || "") +
                " transition-colors border-2 text-neutral-200 border-zinc-700 hover:border-zinc-500 focus:border-zinc-300 bg-black rounded-md px-2 py-1 [&:not(:read-only)]:hover:text-white [&:not(:read-only)]:focus:text-white read-only:text-neutral-500"
            }
            min={min}
            readOnly={readOnly}
            max={max}
            value={text}
            onChange={(e) => {
                setText(e.target.value);

                const number = parseInt(e.target.value, 10);
                if (String(number) === e.target.value && number >= min && number <= max) {
                    onChange(number);
                }
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    commit();
                }
            }}
            onBlur={commit}
        />
    );
}

interface SliderInputProps {
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step?: number;
    className?: string;
    name?: string;
    id?: string;
}
export function SliderInput({
    value,
    onChange,
    min,
    max,
    step,
    className,
    name,
    id,
}: SliderInputProps) {
    return (
        <input
            id={id}
            name={name}
            type="range"
            className={(className || "") + ""}
            min={min}
            max={max}
            step={step ?? "any"}
            value={value}
            onChange={(e) => {
                onChange(Number(e.target.value));
            }}
        />
    );
}

interface BigIntInputProps {
    value: bigint;
    onChange: (value: bigint) => void;
    min: bigint;
    readOnly?: boolean;
    className?: string;
    name?: string;
    id?: string;
}
export function BigIntInput({
    value,
    onChange,
    min,
    readOnly,
    className,
    name,
    id,
}: BigIntInputProps) {
    const [text, setText] = useState(value.toString());

    useEffect(() => {
        setText(value.toString());
    }, [value]);

    const commit = (): void => {
        try {
            const newValue = BigInt(text);
            const clamped = newValue < min ? min : newValue;
            if (clamped !== value) {
                onChange(clamped);
            }
            setText(clamped.toString());
        } catch {
            // reset
            setText(value.toString());
        }
    };

    return (
        <input
            id={id}
            name={name}
            type="number"
            className={
                (className || "") +
                " transition-colors border-2 text-neutral-200 border-zinc-700 hover:border-zinc-500 focus:border-zinc-300 bg-black rounded-md px-2 py-1 [&:not(:read-only)]:hover:text-white [&:not(:read-only)]:focus:text-white read-only:text-neutral-500"
            }
            min={Number(min)}
            readOnly={readOnly}
            value={text}
            onChange={(e) => {
                setText(e.target.value);

                try {
                    const number = BigInt(e.target.value);
                    if (String(number) === e.target.value && number >= min) {
                        onChange(number);
                    }
                } catch {
                    /*ignore */
                }
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    commit();
                }
            }}
            onBlur={commit}
        />
    );
}

interface DownDownProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: readonly T[];
    getLabel?: (value: T) => string;
    className?: string;
    name?: string;
    id?: string;
    disabled?: boolean;
}
export function DownDown<T extends string>({
    value,
    onChange,
    options,
    getLabel = String,
    className,
    name,
    id,
    disabled,
}: DownDownProps<T>) {
    return (
        <select
            id={id}
            name={name}
            disabled={disabled}
            className={
                (className || "") +
                " transition-colors cursor-pointer border-2 text-neutral-200 border-zinc-700 [&:not(:disabled)]:hover:border-zinc-500 focus:border-zinc-300 bg-black rounded-md px-2 py-1 [&:not(:read-only)]:hover:text-white [&:not(:read-only)]:focus:text-white disabled:cursor-default disabled:text-neutral-500"
            }
            value={value}
            onChange={(e) => onChange(e.target.value as T)}
        >
            {options.map((option) => (
                <option key={option} value={option}>
                    {getLabel(option)}
                </option>
            ))}
        </select>
    );
}

interface SmallButtonProps {
    onClick?: () => void;
    className?: string;
    children?: React.ReactNode;
    selected?: boolean;
    title?: string;
    showActive?: boolean;
}
export function SmallButton({
    onClick,
    className,
    children,
    selected,
    title,
    showActive,
}: SmallButtonProps) {
    const bg = selected ? "bg-slate-800" : "bg-black";
    return (
        <button
            className={
                (className || "") +
                " " +
                bg +
                " transition-colors cursor-pointer border-2 text-neutral-200 border-zinc-700 hover:border-zinc-500 rounded-md px-2 py-1 active:bg-slate-800 data-[active]:bg-slate-800 [&:not(:read-only)]:hover:text-white"
            }
            onClick={onClick}
            title={title}
            data-active={showActive ? "true" : undefined}
        >
            {children}
        </button>
    );
}

interface SmallCheckboxProps {
    checked: boolean;
    text: React.ReactNode;
    onChange?: (checked: boolean) => void;
    className?: string;
}
export function SmallCheckbox({ checked, text, onChange, className }: SmallCheckboxProps) {
    return (
        <label
            className={
                (className || "") +
                " select-none cursor-pointer flex items-center gap-2 transition-colors text-neutral-200 hover:text-white"
            }
        >
            <input
                type="checkbox"
                className="size-4 cursor-pointer"
                checked={checked}
                readOnly={!onChange}
                onChange={(e) => {
                    onChange?.(e.target.checked);
                }}
            />
            <span>{text}</span>
        </label>
    );
}
