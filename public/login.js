const form = document.getElementById('login-form');
const input = document.getElementById('password');
const error = document.getElementById('login-error');
const submit = document.getElementById('login-submit');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  submit.disabled = true;
  submit.textContent = 'Checking…';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: input.value }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      window.location.replace('/');
      return;
    }
    error.textContent = data.error || 'Could not sign in';
    error.hidden = false;
    input.select();
  } catch {
    error.textContent = 'Network error — is the server still running?';
    error.hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = 'Unlock';
  }
});
