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

interface DownDownProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: readonly T[];
    getLabel?: (value: T) => string;
    className?: string;
    name?: string;
    id?: string;
}
export function DownDown<T extends string>({
    value,
    onChange,
    options,
    getLabel = String,
    className,
    name,
    id,
}: DownDownProps<T>) {
    return (
        <select
            id={id}
            name={name}
            className={
                (className || "") +
                " transition-colors cursor-pointer border-2 text-neutral-200 border-zinc-700 hover:border-zinc-500 focus:border-zinc-300 bg-black rounded-md px-2 py-1 [&:not(:read-only)]:hover:text-white [&:not(:read-only)]:focus:text-white"
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
}
export function SmallButton({ onClick, className, children, selected, title }: SmallButtonProps) {
    const bg = selected ? "bg-slate-800" : "bg-black";
    return (
        <button
            className={
                (className || "") +
                " " +
                bg +
                " transition-colors cursor-pointer border-2 text-neutral-200 border-zinc-700 hover:border-zinc-500 rounded-md px-2 py-1 active:bg-slate-800 [&:not(:read-only)]:hover:text-white"
            }
            onClick={onClick}
            title={title}
        >
            {children}
        </button>
    );
}
