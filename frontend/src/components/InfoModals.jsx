import React from 'react';
import Modal from './Modal.jsx';

export function PrivacyModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Privacy">
      <div className="space-y-3 text-[13px] text-ink-900 leading-relaxed">
        <p>Nexo is an internal tool. Everything you create lives in your company's database and is visible to other team members based on your role.</p>
        <div>
          <p className="font-semibold mt-2 mb-1">What we store</p>
          <ul className="list-disc pl-5 space-y-1 text-ink-500">
            <li>Projects, tasks, subtasks, comments, and attachments</li>
            <li>Streak activity and mood check-ins</li>
            <li>Calendar events and meeting links</li>
            <li>Your preferences (theme, notification settings)</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold mt-2 mb-1">What we don't do</p>
          <ul className="list-disc pl-5 space-y-1 text-ink-500">
            <li>No third-party analytics or trackers</li>
            <li>No data sharing with external services beyond Google Meet links you generate</li>
            <li>No password storage in plain text (scrypt hashing)</li>
          </ul>
        </div>
        <p className="text-ink-500 text-[12px] pt-2">For data export or deletion requests, contact your workspace admin.</p>
      </div>
    </Modal>
  );
}

export function HelpModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Help & feedback">
      <div className="space-y-3 text-[13px] text-ink-900 leading-relaxed">
        <div>
          <p className="font-semibold mb-1">Getting started</p>
          <ul className="list-disc pl-5 space-y-1 text-ink-500">
            <li>Home shows urgent work first — tackle overdue items before anything else.</li>
            <li>Press <kbd className="px-1.5 py-0.5 rounded border border-line-light bg-[#F9FAFB] text-[11px]">⌘K</kbd> or <kbd className="px-1.5 py-0.5 rounded border border-line-light bg-[#F9FAFB] text-[11px]">Ctrl K</kbd> to jump anywhere fast.</li>
            <li>Use the 👆 poke button to nudge teammates about pending subtasks.</li>
            <li>Create recurring tasks from the + Task modal for routine work.</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold mt-2 mb-1">Tips</p>
          <ul className="list-disc pl-5 space-y-1 text-ink-500">
            <li>When assigning a subtask with a deadline, Nexo warns you if the teammate is on leave.</li>
            <li>Reports → Me/Company toggle switches between personal and team stats.</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold mt-2 mb-1">Feedback</p>
          <p className="text-ink-500">Found a bug or have an idea? Drop a note in your team's <span className="font-semibold">#nexo</span> channel or email it to your workspace admin.</p>
        </div>
      </div>
    </Modal>
  );
}
