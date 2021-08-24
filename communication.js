const { default: axios } = require("axios");

const server_packet_config = {
    headers: {
        "Auth": "7ca28bd22a32fb9c9a47966fa77cabb94f0c6d61a14dbe6c61c6c532e0dd34c8",
    },
};

const send_to_server = async (path, data) =>
{
    if(data)
    {
        const req = await axios.post("http://localhost:44555" + path, data, server_packet_config);

        return req.data;
    }

    else
    {
        const req = await axios.get("http://localhost:44555" + path, server_packet_config);

        return req.data;
    }
}

exports.generate_wallet = async () =>
{
    return await send_to_server("/generatewallet");
}

exports.get_wallet = async (prikey) =>
{
	return await send_to_server("/getwallet", {
		prikey: prikey,
	});
}

exports.get_address_info = async (address) =>
{
	return await send_to_server("/getaddress", {
		address: address,
	});
}

exports.list_transactions = async (addresses, pos=-1, count=64) =>
{
	return await send_to_server("/listtransactions", {
		addresses: addresses,
		limit: count,
		at: pos.toString(),
	});
}

exports.send = async (config) =>
{
	return await send_to_server("/send", config);
}

exports.get_hash_rate = async () =>
{
	return await send_to_server("/gethashrate");
}
