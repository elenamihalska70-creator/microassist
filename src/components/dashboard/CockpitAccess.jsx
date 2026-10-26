import { useId, useRef, useState } from 'react';
import './CockpitAccess.css';

const discoveryCopy = {
  ending: {
    title: '⏳ Ton mode découverte se termine aujourd’hui',
    text: 'Ensuite, tu garderas l’essentiel. Les SMS et rappels avancés arriveront plus tard en Premium :',
    list: ['Smart priorités avancées', 'signaux intelligents', 'automatisations avancées'],
    action: 'Voir les options à venir',
  },
  active: {
    title: '✨ Mode découverte activé',
    text: 'Pendant cette période découverte, tu vois aussi ce que Premium ajoute pour t’aider à agir plus tôt.',
    helper: 'Découvre tes priorités dès maintenant.',
    action: 'Voir mes priorités',
  },
  expired: {
    title: '🔒 Certaines fonctionnalités sont maintenant en Premium',
    text: 'Ton espace reste disponible gratuitement : revenus, factures, exports et suivi de base.',
    helper: 'Les rappels email sont accessibles gratuitement pendant la phase de test. SMS et rappels avancés bientôt en Premium.',
    action: 'Découvrir Premium',
  },
};

// Receives the existing selectors and callbacks; owns only disclosure state.
export default function CockpitAccess({ billing, billingActionLabel, onBillingAction, founder,
  discovery, waitlistJoined, protection, onProtectionAction, qa }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId(), toggle = useRef(null);
  const copy = discoveryCopy[discovery?.kind];
  function toggleDetails() {
    setOpen(!open);
    if (open) toggle.current?.focus();
  }
  return (
    <section className="cockpitAccess" aria-label="Mon accès">
      <div className="cockpitAccessHeading">
        <div>
          <h3>Mon accès</h3>
          <p className="cockpitAccessStatus">{billing.line1}</p>
          {founder && <p>{founder}</p>}
          {copy && <p>{copy.title}</p>}
          {waitlistJoined && <p role="status">✔️ Accès prioritaire activé</p>}
        </div>
        <button ref={toggle} type="button" aria-expanded={open} aria-controls={detailsId} onClick={toggleDetails}>
          {open ? 'Masquer les détails de mon accès' : 'Voir les détails de mon accès'}
        </button>
      </div>
      <div id={detailsId} className="cockpitAccessDetails" hidden={!open}>
        <section aria-label="Détails de facturation">
          <p>{billing.line2}</p>
          {billing.line3 && <p>{billing.line3}</p>}
          <button type="button" onClick={onBillingAction}>{billingActionLabel}</button>
        </section>
        {copy && <section aria-label="Détails de découverte">
          <h4>{copy.title}</h4><p>{copy.text}</p>
          {copy.list && <ul>{copy.list.map(text => <li key={text}>{text}</li>)}</ul>}
          {copy.helper && <p>{copy.helper}</p>}
          <button type="button" onClick={discovery.onClick}>{copy.action}</button>
        </section>}
        {qa && <section aria-label="Mode local"><h4>{qa.label}</h4><p>{qa.text}</p></section>}
        {protection && <section aria-label="Présentation Premium">
          <h4>Sécurise ton activité</h4>
          <p>Aujourd’hui tu es à jour 👍</p><p>Mais sans rappel, tu peux :</p>
          <ul><li>oublier ta déclaration (≈ 45€ de pénalité)</li><li>mal anticiper la TVA</li><li>devoir payer d’un coup</li></ul>
          <p>👉 Microassist garde ces signaux visibles dans ton espace</p>
          <ul><li>✔ Rappels configurables</li><li>✔ Signal TVA visible</li><li>✔ Suivi sans oubli</li></ul>
          <button type="button" onClick={onProtectionAction}>Découvrir Premium</button>
          <p>Gratuit pendant la phase de test. Les tarifs seront définis plus tard.</p>
        </section>}
      </div>
    </section>
  );
}

export function CockpitNavigation({ sections, tools }) {
  function navigate(item, event) {
    // Only animation changes for reduced motion; targets and normal callbacks stay intact.
    if ((item.targetRef || item.targetId) && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const target = item.targetRef?.current || document.getElementById(item.targetId);
      target?.scrollIntoView({ behavior: 'instant', block: 'start' });
    } else item.onClick(event);
  }
  const render = item => item.href
    ? <a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer" onClick={item.onClick}>{item.label}</a>
    : <button key={item.key} type="button" onClick={event => navigate(item, event)}>{item.label}</button>;
  return (
    <nav className="cockpitNavigation" aria-label="Navigation du cockpit">
      <h3>Accéder à mon suivi</h3>
      <div role="group" aria-label="Sections de travail" className="cockpitNavigationLinks">{sections.map(render)}</div>
      <p>Les exports CSV et PDF restent accessibles dans Revenus, selon ton accès.</p>
      <div role="group" aria-label="Outils du cockpit" className="cockpitNavigationLinks">{tools.map(render)}</div>
    </nav>
  );
}
