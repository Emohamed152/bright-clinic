import React from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
export { Link, NavLink, Route, Routes };

export const FileCard = ({ children, lang, dir }: { children: React.ReactNode; lang?: string; dir?: 'rtl' | 'ltr' }) =>
    <main className="file-card" lang={lang} dir={dir}>{children}</main>;
export const Paragraph = ({ children }: { children: React.ReactNode }) => <p className="ui-p">{children}</p>;
export const Caption = ({ children }: { children: React.ReactNode }) => <p className="ui-caption">{children}</p>;
export const Closing = ({ children }: { children: React.ReactNode }) => <p className="ui-closing">{children}</p>;
export const Group = ({ label, heading, children }: { label?: string; heading?: string; children: React.ReactNode }) =>
    <section className="ui-group">{label && <span className="ui-group-label">{label}</span>}{heading && <h2 className="ui-group-heading">{heading}</h2>}{children}</section>;
export const Callout = ({ title, tone, children }: { title?: string; tone?: 'note' | 'warning'; children: React.ReactNode }) =>
    <div className={`ui-callout ui-callout-${tone || 'note'}`}>{title && <strong>{title}</strong>}<span>{children}</span></div>;
export const Photos = ({ label, items }: { label?: string; items: { src: string; alt: string }[] }) =>
    <div className="ui-photos" aria-label={label}>{items.map((p) => <img key={p.src} src={p.src} alt={p.alt} />)}</div>;
export const ChoiceRow = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) =>
    <div className="ui-choice"><span className="ui-field-label">{label}</span><div className="ui-choice-row">
        {options.map((o) => <button type="button" key={o.value} className={o.value === value ? 'ui-chip ui-chip-on' : 'ui-chip'} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div></div>;
export const FileButton = ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: string; pill?: boolean }) =>
    <button type="button" className="ui-btn" disabled={disabled} onClick={onClick}>{children}</button>;
export const CloseButton = ({ onClick }: { onClick: () => void }) => <button type="button" className="ui-close" aria-label="إغلاق" onClick={onClick}>×</button>;
export const TextField = ({ label, value, onChange, type, ltr, required, hidden }: { label: string; value: string; onChange: (v: string) => void; type?: string; ltr?: boolean; required?: boolean; hidden?: boolean }) =>
    <label className="ui-textfield" style={hidden ? { position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' } : undefined}><span className="ui-field-label">{label}{required ? ' *' : ''}</span>
        <input value={value} type={type || 'text'} dir={ltr ? 'ltr' : undefined} tabIndex={hidden ? -1 : undefined} autoComplete={hidden ? 'off' : undefined} onChange={(e) => onChange(e.target.value)} /></label>;
export const Facts = ({ items }: { items: { label: string; value: string }[] }) =>
    <dl className="ui-facts">{items.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>;
export const Rows = ({ children }: { children: React.ReactNode }) => <div className="ui-rows">{children}</div>;
export const Row = ({ name, detail, value }: { name: string; detail?: string; value?: string; valueKnown?: boolean }) =>
    <div className="ui-row"><span className="ui-row-main"><b>{name}</b>{detail && <small>{detail}</small>}</span><span>{value}</span></div>;
export const StackedBar = ({ label, parts }: { label: string; parts: { label: string; share: number }[] }) =>
    <div className="ui-bar"><span className="ui-field-label">{label}</span>
        <div className="ui-bar-track">{parts.map((p, i) => <span key={i} className={`ui-bar-part ui-bar-${i}`} style={{ width: `${p.share}%` }} />)}</div>
        <div className="ui-bar-legend">{parts.map((p, i) => <span key={i}>{p.label}</span>)}</div></div>;
