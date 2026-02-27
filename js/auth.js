// auth.js — AfriStay v2 (with ban check)
(function () {
    const toggleSignin = document.getElementById('btn-signin');
    const toggleSignup = document.getElementById('btn-signup');
    const nameField    = document.getElementById('nameField');
    const authForm     = document.getElementById('authForm');
    const authError    = document.getElementById('authError');
    const authSuccess  = document.getElementById('authSuccess');

    let mode = 'signin';

    function showError(msg) {
        if (authError)   { authError.style.display = 'block'; authError.innerText = msg; }
        if (authSuccess) { authSuccess.style.display = 'none'; authSuccess.innerText = ''; }
    }
    function showSuccess(msg) {
        if (authSuccess) { authSuccess.style.display = 'block'; authSuccess.innerText = msg; }
        if (authError)   { authError.style.display = 'none'; authError.innerText = ''; }
    }

    window.toggleAuth = (m) => {
        mode = m;
        if (mode === 'signup') {
            nameField.classList.remove('hidden');
            toggleSignup.classList.add('active');
            toggleSignin.classList.remove('active');
            authForm.querySelector('.form-title').innerText = 'Sign Up';
        } else {
            nameField.classList.add('hidden');
            toggleSignin.classList.add('active');
            toggleSignup.classList.remove('active');
            authForm.querySelector('.form-title').innerText = 'Sign In';
        }
        showError('');
    };

    toggleAuth('signin');

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showError(''); showSuccess('');

        const fullName = document.getElementById('fullName')?.value?.trim();
        const phone    = document.getElementById('phoneNumber')?.value?.trim();
        const email    = document.getElementById('email')?.value?.trim();
        const password = document.getElementById('password')?.value;

        if (!email || !password) { showError('Email and password required'); return; }

        const client = window.supabaseClient;
        if (!client) { showError('Supabase not configured'); return; }

        try {
            if (mode === 'signup') {
                const { data, error } = await client.auth.signUp({
                    email, password,
                    options: { data: { full_name: fullName || null, phone: phone || null } }
                });
                if (error) { showError(error.message || 'Sign up failed'); return; }
                showSuccess('Sign up successful. Check your email to confirm, then sign in.');

            } else {
                // ── SIGN IN ──
                const { data, error } = await client.auth.signInWithPassword({ email, password });
                if (error) { showError(error.message || 'Sign in failed'); return; }

                const user = data.user;

                // Fetch profile — including banned flag
                const { data: profile, error: pErr } = await client
                    .from('profiles')
                    .select('full_name, role, banned, email')
                    .eq('id', user.id)
                    .single();

                if (pErr) { showError('Could not load your profile.'); return; }

                // ── BAN CHECK ──
                if (profile?.banned === true) {
                    // Sign them back out immediately
                    await client.auth.signOut();
                    // Get admin contact email (first admin in profiles)
                    const { data: admins } = await client
                        .from('profiles')
                        .select('email')
                        .eq('role', 'admin')
                        .limit(1);
                    const adminEmail = admins?.[0]?.email || 'support@afristay.rw';
                    showError(
                        'Your account has been suspended. ' +
                        'Contact ' + adminEmail + ' to appeal.'
                    );
                    return;
                }

                const role      = profile?.role || 'user';
                const firstName = (profile?.full_name || 'User').split(' ')[0];

                localStorage.setItem('afriStay_role', role);
                localStorage.setItem('afriStay_firstName', firstName);

                showSuccess('Welcome back, ' + firstName + '! Redirecting...');
                setTimeout(() => {
                    window.location.href = (role === 'admin' || role === 'owner') ? '/Dashboard' : '/';
                }, 1000);
            }
        } catch (err) {
            console.error('Auth error', err);
            showError('Something went wrong. Please try again.');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && document.activeElement?.form === authForm) {
            authForm.requestSubmit();
        }
    });
})();