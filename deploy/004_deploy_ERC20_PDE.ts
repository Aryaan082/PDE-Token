import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, execute, get} = deployments;

	const {deployer} = await getNamedAccounts();
	const accessRolesAddress = await get('AccessRoles');
	const KYCAddress = await get('ERC721_KYC');
	const burnAddress = await get('ERC721_Burn');

	const log = await deploy('ERC20_PDE', {
		from: deployer,
		args: ['1', '1', accessRolesAddress.address, KYCAddress.address, burnAddress.address],
		log: true,
		autoMine: true,
	});

	await execute('ERC721_Burn', {from: deployer, log: true}, 'setPDE', log.address);
	await execute('AccessRoles', {from: deployer, log: true}, 'grantRole', 3, log.address);
	await execute('ERC20_PDE', {from: deployer, log: true}, 'setPeriodLengthDays', 30);
	await execute('ERC20_PDE', {from: deployer, log: true}, 'setNumPeriods', 3);
	await execute('ERC20_PDE', {from: deployer, log: true}, 'setInterestRateBps', 0, 500);
	await execute('ERC20_PDE', {from: deployer, log: true}, 'setInterestRateBps', 1, 200);
	await execute('ERC20_PDE', {from: deployer, log: true}, 'setInterestRateBps', 2, 70);
};

export default func;
func.tags = ['ERC20_PDE'];
func.dependencies = ['AccessRoles', 'ERC721_Burn', 'ERC721_KYC'];
