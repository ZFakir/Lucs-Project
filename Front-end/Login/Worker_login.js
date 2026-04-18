const loginForm = document.getElementById('MunicipalLoginForm');
const IDInput = document.getElementById('municipalID');
const passwordInput = document.getElementById('password');
const errorMessage=document.getElementById('error');

loginForm.addEventListener('submit', async function(event) {
    // No refresh
    event.preventDefault();

    // Get the values from the inputs
    const username = IDInput.value.trim();//trim removes spaces from end
    const password = passwordInput.value;
    if((!username||!password)){
        errorMessage.textContent="Please your enter your Municipal ID and password";
        errorMessage.classList.remove('hidden');
        return;
    }
    //  Do something with the data
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
            window.location.href = "/<ResidentPage>";
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
async function handleWorkerGoogleResponse(response) {
    try {
        const backendRes = await fetch('/api/auth/worker/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: response.credential })
        });

        const result = await backendRes.json();

        if (backendRes.ok) {
            // Save worker ID and name
            localStorage.setItem('workerId', result.workerId);
            localStorage.setItem('workerName', result.name);
            
            // Redirect to Worker Home
            window.location.href = "../Homes/Worker.html"; 
        } else {
            // Display the specific reason for failure (Admin validation etc)
            const errorElement = document.getElementById('error');
            errorElement.textContent = result.message;
            errorElement.classList.remove('hidden');
            
            // Log it for debugging
            console.warn("Login Blocked:", result.message);
        }
    } catch (err) {
        console.error("Fetch Error:", err);
        const errorElement = document.getElementById('error');
        errorElement.textContent = "Unable to connect to the server.";
        errorElement.classList.remove('hidden');
    }
}

window.onload = function () {
    //  Link your Client ID and your callback function
    google.accounts.id.initialize({
        client_id: "807391346984-tnskuijp45bnadk8ki9b87j7q4hd3dq4.apps.googleusercontent.com",
        callback: handleWorkerGoogleResponse,
        context: "signin",
        ux_mode: "popup" 
    });

    // Render the button 
    google.accounts.id.renderButton(
        document.getElementById("google-worker-btn"), 
        { 
            theme: "filled_black", 
            size: "large", 
            width: 350, 
            shape: "rectangular" 
        }
    );
};