import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy, get} = deployments;

	const {deployer} = await getNamedAccounts();
	const accessRolesAddress = await get('AccessRoles');

	await deploy('ERC721_Burn', {
		from: deployer,
		args: ['B', 'B', accessRolesAddress.address],
		log: true,
		autoMine: true,
	});
};

export default func;
func.tags = ['ERC721_Burn'];
func.dependencies = ['AccessRoles'];
