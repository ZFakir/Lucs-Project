const loginForm = document.getElementById('ResidentLoginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorMessage=document.getElementById('error');

loginForm.addEventListener('submit', async function(event) {
    // No refresh
    event.preventDefault();

    // Get the values from the inputs
    const username = usernameInput.value.trim();//trim removes spaces from end
    const password = passwordInput.value;
    if((!username||!password)){
        errorMessage.textContent="Please your enter username and password";
        errorMessage.classList.remove('hidden');
        return;
    }
    // Do something with the data
    try {
        // This is where you send the ID and Password to your server
        // which then talks to Google's API
        const response = await fetch('</api/login>', {//Change once db runs
            method: 'POST',
            body: JSON.stringify({ username, password }),
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (response.ok) {
            //displayMessage("Success! Redirecting...", "success");
            localStorage.setItem('residentId', result.residentId);
            window.location.href = "../Homes/Resident.html";
        } else {
            errorMessage.textContent="Incorrect username or password";
            errorMessage.classList.remove('hidden');
        }
    } catch (err) {
        errorMessage.textContent = "Something has gone terribly wrong.";
        errorMessage.classList.remove('hidden');
    }   
});

//google auth
window.onload = function () {
  google.accounts.id.initialize({
    client_id: "807391346984-tnskuijp45bnadk8ki9b87j7q4hd3dq4.apps.googleusercontent.com",
    callback: handleCredentialResponse,
    context: "signin",
    ux_mode: "popup" // Or "redirect"
  });

  google.accounts.id.renderButton(
    document.getElementById("google-login-btn"),
    { 
        theme: "filled_black", 
        size: "large", 
        width: 400, 
        shape: "rectangular" 
    }
  );
};

async function handleCredentialResponse(response) {
    // response.credential is a JWT token
    const token = response.credential;

    try {
        const backendRes = await fetch('/api/auth/google', { //send to backend
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token })
        });

        const result = await backendRes.json();

        if (backendRes.ok) {
            
            //check if admin first
            if (result.role === 'admin') {
                window.location.href = "../Homes/Admin.html";
            } else { //if not admin, normal resident
                localStorage.setItem('residentId', result.residentId); //saves ID to localstorage
                window.location.href = "../Homes/Resident.html"; 
            }
        } else {
            errorMessage.textContent = "Google Sign-In failed.";
            errorMessage.classList.remove('hidden');
        }
    } catch (err) {
        console.error("Auth Error:", err);
    }
}