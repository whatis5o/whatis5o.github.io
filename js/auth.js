// auth.js
(function () {
    const toggleSignin = document.getElementById('btn-signin');
    const toggleSignup = document.getElementById('btn-signup');
    const nameField = document.getElementById('nameField');
    const authForm = document.getElementById('authForm');
    const authError = document.getElementById('authError');
    const authSuccess = document.getElementById('authSuccess');

    let mode = 'signin'; // or 'signup'

    function showError(msg) {
        if (authError) { authError.style.display = 'block'; authError.innerText = msg; }
        if (authSuccess) { authSuccess.style.display = 'none'; authSuccess.innerText = ''; }
    }
    function showSuccess(msg) {
        if (authSuccess) { authSuccess.style.display = 'block'; authSuccess.innerText = msg; }
        if (authError) { authError.style.display = 'none'; authError.innerText = ''; }
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
        // clear messages
        showError('');
    };

    // default
    toggleAuth('signin');

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showError(''); showSuccess('');

        const fullName = document.getElementById('fullName')?.value?.trim();
        const phone = document.getElementById('phoneNumber')?.value?.trim();
        const email = document.getElementById('email')?.value?.trim();
        const password = document.getElementById('password')?.value;

        if (!email || !password) { showError('Email and password required'); return; }

        const client = window.supabaseClient;

        if (!client) { showError('Supabase not configured'); return; }

        try {
        if (mode === 'signup') {
            // Use signUp and attach metadata for profile creation
            const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName || null, phone: phone || null }
            }
            });

            if (error) {
            showError(error.message || 'Sign up failed');
            return;
            }

            // Success: email confirmation may be required in your Supabase settings
            showSuccess('Sign up successful. Check your email to confirm then login.');
        } else {
            // sign in
            // ... (inside the else block for sign in)
            const { data, error } = await client.auth.signInWithPassword({ email, password });
            if (error) {
                showError(error.message || 'Sign in failed');
                return;
            }

            // Fetch profile to get role and name
            const user = data.user;
            const { data: profile } = await client.from('profiles').select('full_name, role').eq('id', user.id).single();
            const role = profile?.role || 'user';
            const firstName = (profile?.full_name || 'User').split(' ')[0];

            // MAGIC SPEED FIX: Cache the role and name locally so the next page loads instantly!
            localStorage.setItem('afriStay_role', role);
            localStorage.setItem('afriStay_firstName', firstName);

            showSuccess(`Welcome back, ${firstName}! Redirecting...`);
            setTimeout(() => { window.location.href = '/Dashboard'; }, 1000);
        }
        } catch (err) {
        console.error('Auth error', err);
        showError('Something went wrong with auth.');
        }
    });

    // quick keyboard enter handling
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && document.activeElement && document.activeElement.form === authForm) {
        authForm.requestSubmit();
        }
    });
})();
