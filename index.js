
const communication = require("./communication.js");
const CryptoJS = require("crypto-js");
const Crypto = require("crypto");
const fs = require("fs");

let wallets = [];
let adjectives = [];
let nouns = [];
let wallet_selected_e = undefined;
let wallet_selected = undefined;
let password = "";
let salt = "";

let form_send_in = []
let form_send_out = []

function update_wallet_fs()
{
	let data = {
		wallets: [],
	}

	for(let wallet of wallets)
	{
		data.wallets.push({
			prikey: wallet.prikey,
			name: wallet.name,
		});
	}
	
	let data_s = JSON.stringify(data);
	let data_e = CryptoJS.AES.encrypt(data_s.toString(), password);

	fs.writeFileSync("wallet.bin", salt + data_e.toString());
}

function create_send_popup()
{
	form_send_out = []
	form_send_in = []
	
	create_popup(`
		<h1>Send funds</h1>
		<div style="margin: 8px 0;">
		<p>Inputs</p>
		<div id="Form-Send-In"></div>
		<button onclick="form_send_add_in()">Add</button>
		</div>
		<div style="margin: 8px 0;">
		<p>Outputs</p>
		<div id="Form-Send-Out"></div>
		<button onclick="form_send_add_out()">Add</button>
		</div>
		<p id="Form-Info" class="Info"></p>
		<button id="Form-Submit" onclick="form_send_transaction()">Send</button>
		<button id="Form-Close" onclick="close_popup()">Close</button>
		<p id="Form-Eta" class="Info"></p>
	`);
}

function form_send_add_out()
{
	let e = document.createElement("div");
	e.innerHTML = `
		<input id="Form-Address" type="text" placeholder="Address" style="width: 600px;">
		<input id="Form-Amount" type="number" min="1" placeholder="Amount" style="width: 120px;">
		<select id="Form-Scale" style="width: 120px;">
			<option value="1">c (1 c)</option>
			<option value="2">kc (1000 c)</option>
			<option value="3">Mc (1000 kc)</option>
			<option value="4">Gc (1000 Mc)</option>
			<option value="5">Tc (1000 Gc)</option>
			<option value="6">Ec (1000 Tc)</option>
		</select>
		<button onClick="form_send_remove_out(${form_send_out.length})">X</button>
		<textarea id="Form-Message" style="width: 860px; height: 80px;" maxlength="65535"></textarea>
	`;
	
	form_send_out.push(e);
	document.getElementById("Form-Send-Out").appendChild(e);
}

function form_send_add_in()
{
	let e = document.createElement("div");
	e.innerHTML = `
		<select id="Form-From" style="width: 610px;"></select>
		<input id="Form-Amount" type="number" min="1" placeholder="Amount" style="width: 120px;">
		<select id="Form-Scale" style="width: 120px;">
			<option value="1">c (1 c)</option>
			<option value="2">kc (1000 c)</option>
			<option value="3">Mc (1000 kc)</option>
			<option value="4">Gc (1000 Mc)</option>
			<option value="5">Tc (1000 Gc)</option>
			<option value="6">Ec (1000 Tc)</option>
		</select>
		<button onClick="form_send_remove_in(${form_send_in.length})">X</button>
	`;
	
	form_send_in.push(e);
	document.getElementById("Form-Send-In").appendChild(e);
	
	let e_from = e.querySelector("#Form-From");
	
	for(let wallet of wallets)
	{
		let e_option = document.createElement("option");
		e_option.innerHTML = `${sanitize_text(wallet.name)} (${display_balance(wallet.balance)})`;
		e_option.value = wallet.name;
		e_from.appendChild(e_option);
	}
}

function form_send_remove_out(at)
{
	form_send_out[at].remove();
	form_send_out[at] = undefined;
}

function form_send_remove_in(at)
{
	form_send_in[at].remove();
	form_send_in[at] = undefined;
}

async function form_send_transaction()
{
	let inputs = [];
	let outputs = [];
	
	try
	{
		for(let e of form_send_in)
		{
			if(!e) continue;

			let prikey = "";
			let from = e.querySelector("#Form-From").value;
			let amount = e.querySelector("#Form-Amount").value;
			let scale = e.querySelector("#Form-Scale").value;
			let m = 1;

			switch(scale)
			{
				case "1":
					m = 1n;
					break;
				case "2":
					m = 1000n;
					break;
				case "3":
					m = 1000000n;
					break;
				case "4":
					m = 1000000000n;
					break;
				case "5":
					m = 1000000000000n;
					break;
				case "6":
					m = 1000000000000000n;
					break;
			}

			for(let wallet of wallets)
			{
				if(wallet.name === from)
				{
					prikey = wallet.prikey;
					break;
				}
			}

			amount = BigInt(amount) * m;

			inputs.push({
				prikey: prikey,
				amount: amount.toString(),
			});
		}

		for(let e of form_send_out)
		{
			if(!e) continue;

			let address = e.querySelector("#Form-Address").value;
			let amount = e.querySelector("#Form-Amount").value;
			let msg = e.querySelector("#Form-Message").value;
			let scale = e.querySelector("#Form-Scale").value;
			let m = 1;

			switch(scale)
			{
				case "1":
					m = 1n;
					break;
				case "2":
					m = 1000n;
					break;
				case "3":
					m = 1000000n;
					break;
				case "4":
					m = 1000000000n;
					break;
				case "5":
					m = 1000000000000n;
					break;
				case "6":
					m = 1000000000000000n;
					break;
			}

			amount = BigInt(amount) * m;

			outputs.push({
				address: address,
				amount: amount.toString(),
				msg: msg,
			});
		}
	}

	catch(e)
	{
		document.getElementById("Form-Info").innerHTML = "invalid format";
		console.error(e);
		return;
	}

	document.getElementById("Form-Close").disabled = true;
	document.getElementById("Form-Submit").disabled = true;

	var running = true;

	const update = async () =>
	{
		if(running)
		{
			setTimeout(() => {update()}, 1000);
		}

		else
		{
			return;
		}

		let res = await communication.get_hash_rate();
		let seconds = res.eta;
		let time_str = "";

		if(seconds < 60)
		{
			time_str = `${(seconds).toFixed(0)} seconds remaining`;
		}

		else if(seconds < 3600)
		{
			time_str = `${(seconds / 60).toFixed(0)} minutes ${(seconds % 60).toFixed(0)} seconds remaining`;
		}

		else if(seconds < 86400)
		{
			time_str = `${(seconds / 3600).toFixed(0)} hours ${((seconds % 3600) / 60).toFixed(0)} minutes remaining`;
		}

		else if(seconds < 2592000)
		{
			time_str = `${(seconds / 86400).toFixed(0)} days ${((seconds % 86400) / 3600).toFixed(0)} hours rmaining`;
		}

		else
		{
			time_str = `${(seconds / 2592000).toFixed(0)} years ${((seconds % 2592000) / 86400).toFixed(0)} days remaining`;
		}
		
		document.getElementById("Form-Eta").innerHTML = sanitize_text(`${time_str} at ${res.hashrate} H/s`);
	};

	setTimeout(() => {update()}, 1000);

	let res = await communication.send({
		inputs: inputs,
		outputs: outputs,
	});

	running = false;
	
	if(res.error)
	{
		document.getElementById("Form-Eta").innerHTML = "";
		document.getElementById("Form-Info").innerHTML = sanitize_text(res.error);
		document.getElementById("Form-Close").disabled = false;
		document.getElementById("Form-Submit").disabled = false;
		return;
	}
	
	await update_wallets();
	
	close_popup();
}

function create_delete_popup()
{
	create_popup(`
		<h1>Delete wallet</h1>
		<p>
			If you don't already have a copy of this wallet,
			your coins will be destroyed as well as any coins
			sent here in the future. Are you sure you want to
			do this? To continue, please type this wallets full
			name (case sensitive). 
		</p>
		<p>
			Wallet name: ${sanitize_text(wallet_selected.name)}<br/>
			Balance: ${sanitize_text(display_balance(wallet_selected.balance))}
		</p>
		<p style="margin-bottom: 0;">Wallet name<br/><input type="text" id="Form-WalletName"></p>
		<p style="margin-bottom: 0;" id="Form-Info" class="Info"></p>
		<div style="height: 16px"></div>
		<button onclick="delete_wallet()">Yes</button>
		<button onclick="close_popup()">No</button>
	`)
}

function create_export_popup()
{
	create_popup(`
		<h1>${sanitize_text(wallet_selected.name)}</h1>
		<p>
			You are about to show very sensitive information
			which includes this wallets private key. Anyone
			with the private key will be able to spend funds
			from this address. Do you still want to export?
		</p>
		<button onclick="create_export_popup_window()">Yes</button>
		<button onclick="close_popup()">No</button>
	`);
}

function create_export_popup_window()
{
	create_popup(`
		<h1>${sanitize_text(wallet_selected.name)}</h1>
		<table>
			<td>
				<p style="margin-bottom: 4px">Spend</p>
				<div class="QRCode" id="ExportQRPrikey"></div>
				<p class="Info" style="font-size: 12px"><code>${sanitize_text(wallet_selected.prikey)}</code></p>
			</td>
			<td><div style="width: 120px"></div></td>
			<td>
				<p style="margin-bottom: 4px">Receive</p>
				<div class="QRCode" id="ExportQRAddress"></div>
				<p class="Info" style="font-size: 12px"><code>${sanitize_text(wallet_selected.address)}</code></p>
			</td>
		</table>
		<div style="height: 16px"></div>
		<button onClick="close_popup()">Close</button>
	`);
	
	// display the qr codes
	new QRCode(document.getElementById("ExportQRPrikey"), {
		text: wallet_selected.prikey,
		width: 320,
		height: 320,
		colorDark: "#292a2f",
		colorLight: "#eaeaef",
		correctLevel: QRCode.CorrectLevel.M,
	});

	new QRCode(document.getElementById("ExportQRAddress"), {
		text: wallet_selected.address,
		width: 320,
		height: 320,
		colorDark: "#292a2f",
		colorLight: "#eaeaef",
		correctLevel: QRCode.CorrectLevel.M,
	});
}

async function update_wallets()
{
	let addresses = []
	
	for(let wallet of wallets)
	{
		addresses.push_back(wallet.address)
	}

	let res = await communication.list_transactions(addresses);
	
	for(let tx of addresses)
	{
		for(let wallet of wallets)
		{
			if(wallet.address === tx.address)
			{
				let found = false;

				for(let htx of wallet.history)
				{
					if(htx.txid === tx.txid)
					{
						found = true;

						break;
					}
				}

				if(!found)
				{
					wallet.history.shift(tx);
					
					if(tx.type === "receive")
					{
						wallet.balance += BigInt(tx.amount);
					}

					else if(tx.type === "send")
					{
						wallet.balance -= BigInt(tx.amount);
					}
				}
			}
		}
	}
}

function view_transaction(txid)
{
	let tx = undefined;
	
	for(let c of wallet_selected.history)
	{
		if(c.txid === txid)
		{
			tx = c;
			break;
		}
	}

	if(!tx)
	{
		console.error("Transaction "+txid+" doesn't exist");
		return;
	}

	let inputs_html = ``;
	let outputs_html = ``;

	for(let input of tx.inputs)
	{
		inputs_html += `
			<tr>
				<td><p class="AddressRow">${sanitize_text(input.address)}</p></td>
				<td><p class="AddressRow">${display_balance(input.amount)}</p></td>
			</tr>
		`;
	}

	for(let output of tx.outputs)
	{
		outputs_html += `
			<tr>
				<td><p class="AddressRow">${sanitize_text(output.address)}</p></td>
				<td><p class="AddressRow">${display_balance(output.amount)}</p></td>
			</tr>
		`;
	}

	create_popup(`
		<h1>View transaction</h1>
		<p>
			Transaction ID: ${sanitize_text(tx.txid)}<br/>
			Amount: ${display_balance(tx.amount)}<br/>
			Confirms: ${sanitize_text(tx.confirms.toString())}<br/>
			</p><p style="margin-bottom: 0;">
			Inputs: </p><table>${inputs_html}</table>
			<p style="margin-bottom: 0;">
			Outputs: </p><table>${outputs_html}</table><p style="margin-top: 0;">
			${tx.msg ? `Message: <br/>${sanitize_text(tx.txid)}` : ``}
		</p>
		<button onclick="close_popup()">Close</button>
	`);
}

function create_popup(html)
{
	document.getElementById("HoverMenu").innerHTML = `
		<div class="Overlay"></div>
		<div class="Box">${html}</div>
	`;
}

function close_popup()
{
	document.getElementById("HoverMenu").innerHTML = "";
}

function delete_wallet()
{
	// check if the wallet name is correct
	if(document.getElementById("Form-WalletName").value !== wallet_selected.name)
	{
		document.getElementById("Form-Info").innerHTML = "Invalid wallet name";
		return;
	}
	
	// delete the wallet and update fs
	for(let i = 0; i < wallets.length; i++)
	{
		if(wallets[i] === wallet_selected)
		{
			wallets.splice(i, 1);

			break;
		}
	}

	update_wallet_buttons();
	update_wallet_fs();
	close_popup();
	
	if(wallets.length === 0)
	{
		create_new_wallet();
	}

	else
	{
		select_wallet(0);
	}
}

async function load_wallet_fs(create=false)
{
	let wallet_exists = fs.existsSync("wallet.bin");
	
	// create a new wallet if the wallet doesn't already exist
	if(!create && !wallet_exists)
	{
		let body_html = `
			<div style="padding: 50px; width: 400px;">
			<h1>Create new wallet</h1>
			<p>
				Thank you for using this software. 
			</p>
			<p>
				To get started, please pick a secure encryption
				password that is at least 8 characters long. If
				you forget this password, you will not be able
				to access your wallet. 
			</p>
			<p>Password<br/><input type="password" id="Form-Password" /></p>
			<p style="margin-bottom: 0">Confirm<br/><input type="password" id="Form-Confirm" /></p>
			<p class="Info" id="Form-Info"></p>
			<button style="margin-top: 12px" onclick="initialize_fs()">Submit</button>
			</div>
		`;

		document.getElementById("Body").innerHTML = body_html;

		return;
	}

	// open a login screen if the user isn't already logged in
	else if(!create)
	{
		let body_html = `
			<div style="padding: 50px; width: 400px;">
			<h1>Login to your wallet</h1>
			<p style="margin-bottom: 0">Password<br/><input type="password" id="Form-Password" /></p>
			<p class="Info" id="Form-Info"></p>
			<button style="margin-top: 12px" onclick="login()">Login</button>
			</div>
		`;

		document.getElementById("Body").innerHTML = body_html;

		return;
	}

	if(wallet_exists)
	{
		try
		{
			let data_enc = fs.readFileSync("wallet.bin").toString();

			salt = data_enc.substr(0, 44);
			data_enc = data_enc.substr(44);
			password = CryptoJS.SHA256(document.getElementById("Form-Password").value + salt).toString();

			let data = JSON.parse(CryptoJS.AES.decrypt(data_enc, password).toString(CryptoJS.enc.Utf8));

			for(let raw_wallet of data.wallets)
			{
				let wallet = await communication.get_wallet(raw_wallet.prikey);
				let info = await communication.get_address_info(wallet.address);
				let transactions = (await communication.list_transactions([wallet.address]))["transactions"];
	
				if(!transactions)
				{
					transactions = [];
				}
				
				wallets.push(
				{
					name: raw_wallet.name,
					prikey: wallet.prikey,
					address: wallet.address,
					balance: info.balance,
					history: transactions,
				});
			}
		}

		catch(e)
		{
			console.error(e);

			document.getElementById("Form-Info").innerHTML = "Incorrect password";

			return;
		}

	}

	else
	{
		update_wallet_fs();
	}
	
	// show the logged in window
	let body_html = `
		<div class="WalletMenu">
			<div id="WalletItems"></div>
			<div id="ButtonAddWallet" class="Button Selected" onclick="create_new_wallet()">
				<p>Add Wallet</p>
			</div>
		</div>
		<div id="MainMenu"></div>
		<div id="HoverMenu"></div>
	`;

	document.getElementById("Body").innerHTML = body_html;
	update_wallet_buttons();

	if(wallets.length === 0)
	{
		create_new_wallet(true);
	}

	else
	{
		select_wallet(0);
	}
	
	setInterval(() => {update_wallets()}, 5000);
}

function initialize_fs()
{
	let pass = document.getElementById("Form-Password").value;
	let pass_c = document.getElementById("Form-Confirm").value;
	let error = "";

	if(pass !== pass_c)
	{
		error = "Passwords must be the same";
	}

	else if(pass.length < 8)
	{
		error = "Password is too short";
	}

	if(error.length > 0)
	{
		document.getElementById("Form-Info").innerHTML = error;
		return;
	}

	salt = Crypto.randomBytes(32).toString("base64");
	password = CryptoJS.SHA256(pass + salt.toString("base64")).toString();
	load_wallet_fs(true);
}

function login()
{
	load_wallet_fs(true);
}

function display_balance(amount, dp=6)
{
	const signs = "kMGTPE";
	let at = 0;

	while(amount >= 1000)
	{
		at += 1;
		amount /= 1000;
	}

	if(at == 0)
	{
		return amount.toString() + " c";
	}

	else
	{
		return amount.toFixed(dp) + " " + signs[at - 1] + "c";
	}
}

async function select_wallet(i)
{
	let e = document.getElementById(`WalletButton_${i}`);
	
	if(wallet_selected_e === e)
	{
		return;
	}
	
	if(wallet_selected_e)
	{
		wallet_selected_e.classList.remove("Selected");
	}

	document.getElementById("ButtonAddWallet").classList.remove("Selected");
	e.classList.add("Selected");
	
	wallet_selected = wallets[i];
	wallet_selected_e = e;
	
	display_wallet();
}

function update_wallet_buttons()
{
	let new_html = "";
	let i = 0;

	for(let wallet of wallets)
	{
		new_html += `
			<div class="Button WalletButton" id="WalletButton_${i}" onclick="select_wallet(${i})"><p>${sanitize_text(wallet.name)}</p>
			<p class="WalletInfoText">${sanitize_text(display_balance(wallet.balance))}</p></div>`;
		i += 1;
	}
	
	document.getElementById("WalletItems").innerHTML = new_html;
}

function check_wallet_name_duplicates(name)
{
	for(wallet of wallets)
	{
		if(wallet.name == name)
		{
			return true;
		}
	}
	
	return false;
}

function display_wallet()
{
	main_html =
	`
		<h1>${sanitize_text(wallet_selected.name)}</h1>
		<div class="WalletRightSide">
		<h1>Receive funds</h1>
		<p>Balance: ${sanitize_text(display_balance(wallet_selected.balance))}</p>
		<div class="QRCode" id="WalletMainAddressQr"></div>
		<p class="Info" style="font-size: 12px"><code>${sanitize_text(wallet_selected.address)}</code></p>
		<p>Balance history</p>
		<canvas id="RecentTransactionsChart"></canvas>
		<div style="height: 20px;"></div>
		<button onclick="create_send_popup()">Send</button>
		<button onclick="create_export_popup()">Export</button>
		<button onclick="create_delete_popup()">Delete</button>
		</div>
		<p>Recent transactions</p>
		<div id="WalletRecentTransactions"></div>
	`;

	document.getElementById("MainMenu").innerHTML = main_html;

	// display the qr code
	new QRCode(document.getElementById("WalletMainAddressQr"), {
		text: wallet_selected.address,
		width: 200,
		height: 200,
		colorDark: "#292a2f",
		colorLight: "#eaeaef",
		correctLevel: QRCode.CorrectLevel.M,
	});
	
	let wallet_recent_txs_e = document.getElementById("WalletRecentTransactions");
	let chart_xvalues = [];
	let chart_yvalues = [];
	let balance = BigInt(wallet_selected.balance);
	let received_text = undefined;
	let it = 0;

	// display the transactions
	for(let tx of wallet_selected.history)
	{
		let msg = "";
		let address = "";
		let minus = "";
		let classes_extra = "";
		
		let received = new Date(Number(BigInt(tx.received) / 1000n));
		received_text = `${received.getDate()}/${received.getMonth() + 1}/${received.getYear() + 1900
				} ${received.getHours()}:${received.getMinutes()}:${received.getSeconds()}`;

		chart_xvalues.unshift(received_text);
		chart_yvalues.unshift(Number(balance));
		it += 1;

		if(tx.type === "spend")
		{
			minus = "-";
			msg = "Sent to";
			classes_extra = "Spend";
			balance += BigInt(tx.amount);

			if(tx.outputs.length > 1)
			{
				address = tx.outputs.length.toString() + " addresses";
			}

			else if(tx.outputs.length === 1)
			{
				address = tx.outputs[0].address;
			}

			else
			{
				address = "unknown";
			}
		}

		else if(tx.type === "receive")
		{
			msg = "Received from";
			classes_extra = "Receive";
			balance -= BigInt(tx.amount);

			if(tx.inputs.length > 1)
			{
				address = tx.inputs.length.toString() + " wallets";
			}

			else if(tx.inputs.length === 1)
			{
				address = tx.inputs[0].address;
			}

			else
			{
				address = "unknown";
			}
		}

		let tx_html = `
			<div onclick="view_transaction('${sanitize_text(tx.txid)}')" class="Transaction ${classes_extra}">
			<p>${sanitize_text(msg + " " + address)}</p>
			<p style="text-align: right;">
			${sanitize_text(minus + display_balance(tx.amount))}
			</p><p>
			${sanitize_text(received_text)}
			</p>
			</div>
		`;
		let e = document.createElement("div");
		e.innerHTML = tx_html;

		wallet_recent_txs_e.appendChild(e);
	}

	if(received_text)
	{
		chart_xvalues.unshift(received_text);
		chart_yvalues.unshift(Number(balance));
	}
	
	// render the graph
	new Chart("RecentTransactionsChart", {
		type: "line",
		data: {
			labels: chart_xvalues,
			datasets: [{
				data: chart_yvalues,
				backgroundColor: "#292a2f",
				borderColor: "#292a2f",
			}],
		},
		options: {
			plugins: {
				legend: {
					display: false,
				},
				tooltip: {
					callbacks: {
						label: (context) => {
							return display_balance(context.parsed.y);
						},
					},
				},
			},
			legend: false,
			scales: {
				x: {
					display: false,
				},
				y: {
					display: true,
					beginAtZero: true,
					grid: {
						display: false,
					},
					ticks: {
						callback: (value, index, values) => {
							return display_balance(value, 0);
						},
					},
				}
			},
		},
	});
}

function create_new_wallet(force=false)
{
	if(!wallet_selected_e && !force)
	{
		return;
	}
	
	main_html = `

		<h1>Add a new wallet</h1>
		<p><input id="Form-ImportPrivateKey" type="checkbox" onchange="on_prikey_checkbox_toggle()" />
		import private key</p>
		<p style="margin-bottom: 0">Wallet name<br/>
		<input id="Form-WalletName" type="text" maxlength="30" /></p>
		<div id="Form-PrivateKeyArea"></div>
		<p class="Info" id="Form-Errors"></p>
		<button style="margin-top: 12px" id="Form-Submit" onclick="add_new_wallet()">Create</Button>

	`;

	let name = get_random_adjective() + " " + get_random_noun();

	while(check_wallet_name_duplicates(name))
	{
		name = get_random_adjective() + " " + get_random_noun();
	}
	
	document.getElementById("MainMenu").innerHTML = main_html;
	document.getElementById("Form-WalletName").value = name;
	document.getElementById("ButtonAddWallet").classList.add("Selected");

	if(wallet_selected_e)
	{
		wallet_selected_e.classList.remove("Selected");
		wallet_selected_e = undefined;
	}
}

function on_prikey_checkbox_toggle()
{
	let checked = document.getElementById("Form-ImportPrivateKey").checked;
	let submit_button_text = "Create";
	let prikey_html = "";

	if(checked)
	{
		prikey_html = `<p style="margin-bottom: 0; margin-top: 12px;">Private key<br/><input type="text" id="Form-PrivateKey" maxlength="55" /></p>`;
		submit_button_text = "Import";
	}

	document.getElementById("Form-PrivateKeyArea").innerHTML = prikey_html;
	document.getElementById("Form-Submit").innerHTML = sanitize_text(submit_button_text);
}

async function add_new_wallet()
{
	let import_private_key = document.getElementById("Form-ImportPrivateKey").checked;
	let wallet_name = document.getElementById("Form-WalletName").value;
	let error = "";
	let wallet;

	// no wallet name
	if(wallet_name.length <= 0)
	{
		error = "wallet name is required";
	}

	// handle errors
	if(error)
	{
		document.getElementById("Form-Errors").innerHTML = sanitize_text(error);

		return;
	}

	document.getElementById("Form-Submit").disabled = true;

	if(import_private_key)
	{
		let private_key = document.getElementById("Form-PrivateKey").value;

		if(private_key.length !== 55)
		{
			document.getElementById("Form-Errors").innerHTML = "invalid private key";
			document.getElementById("Form-Submit").disabled = false;

			return;
		}

		wallet = await communication.get_wallet(private_key);

		if(wallet.error)
		{
			document.getElementById("Form-Errors").innerHTML = "invalid private key";
			document.getElementById("Form-Submit").disabled = false;

			return;
		}
	}

	else
	{
		wallet = await communication.generate_wallet();
	}

	// does this wallet name already exist here
	for(let check of wallets)
	{
		if(check.name === wallet_name)
		{
			error = "wallet name already exists";
			break;
		}
	}

	let info = await communication.get_address_info(wallet.address);
	let transactions = (await communication.list_transactions([wallet.address]))["transactions"];
	
	if(!transactions)
	{
		transactions = [];
	}
	
	wallets.push(
	{
		name: wallet_name,
		prikey: wallet.prikey,
		address: wallet.address,
		balance: info.balance,
		history: transactions,
	});

	update_wallet_buttons();
	update_wallet_fs();
	select_wallet(wallets.length - 1);
}

function capitalize(word)
{
	return word.substr(0, 1).toUpperCase() + word.substr(1, word.length - 1).toLowerCase()
}

function get_random_adjective()
{
	word = adjectives[Math.floor(Math.random() * adjectives.length)].split(" ");
	
	if(word.length > 0)
	{
		return capitalize(word[Math.floor(Math.random() * word.length)])
	}

	else
	{
		return get_random_adjective()
	}
}

function get_random_noun()
{
	word = nouns[Math.floor(Math.random() * nouns.length)].split(" ");

	if(word.length > 0)
	{
		return capitalize(word[Math.floor(Math.random() * word.length)])
	}

	else
	{
		return get_random_noun()
	}
}

function load_words()
{
	// load adjectives
	adjectives = fs.readFileSync("./words/adj.exc").toString().split("\n");
	nouns = fs.readFileSync("./words/noun.exc").toString().split("\n");
}

function sanitize_text(text)
{
	text = text.replace(/&/g, "&amp;");
	text = text.replace(new RegExp('"', 'g'), "&quot;");
	text = text.replace(new RegExp("'", 'g'), "&apos;");
	text = text.replace(/</g, "&lt;");
	text = text.replace(/>/g, "&gt;");

	return text;
}

function on_load()
{
	load_words();
	load_wallet_fs();
}

