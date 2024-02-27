import {expect} from 'chai';
import {ethers, deployments, getUnnamedAccounts, getNamedAccounts} from 'hardhat';
import {AccessRoles} from '../typechain-types';
import {setupUser, setupUsers} from './utils';

const setup = deployments.createFixture(async () => {
	await deployments.fixture('AccessRoles');
	const {deployer, accountOne, accountTwo, accountThree} = await getNamedAccounts();
	const contracts = {
		AccessRoles: await ethers.getContract<AccessRoles>('AccessRoles'),
	};
	const users = await setupUsers(await getUnnamedAccounts(), contracts);
	return {
		...contracts,
		users,
		deployer: await setupUser(deployer, contracts),
		accountOne: await setupUser(accountOne, contracts),
		accountTwo: await setupUser(accountTwo, contracts),
		accountThree: await setupUser(accountThree, contracts),
	};
});

describe('AccessRoles', function () {
	it('tests hasRole', async function () {
		const {AccessRoles, deployer} = await setup();

		expect(await AccessRoles.hasRole(0, deployer.address)).equal(false);
		expect(await AccessRoles.hasRole(2, deployer.address)).equal(true);
	});

	it('tests getRole', async function () {
		const {AccessRoles, deployer, accountOne} = await setup();

		expect(await AccessRoles.getRole(deployer.address)).equal(2);
		expect(await AccessRoles.getRole(accountOne.address)).equal(0);
	});

	it('tests grantRole', async function () {
		const {AccessRoles, deployer, accountOne} = await setup();

		await deployer.AccessRoles.grantRole(1, accountOne.address);

		expect(await AccessRoles.hasRole(1, accountOne.address)).equals(true);
	});

	it('tests revokeRole', async function () {
		const {AccessRoles, deployer, accountOne} = await setup();

		await deployer.AccessRoles.grantRole(1, accountOne.address);

		await deployer.AccessRoles.revokeRole(accountOne.address);

		expect(await AccessRoles.hasRole(0, accountOne.address)).equals(true);
	});

	it('tests onlyRole (modifier)', async function () {
		const {AccessRoles, deployer, accountOne, accountTwo} = await setup();

		await deployer.AccessRoles.grantRole(1, accountOne.address);

		expect(AccessRoles.hasRole(1, accountOne.address));

		await expect(accountOne.AccessRoles.grantRole(2, accountTwo.address)).to.be.revertedWith(
			'ERC721: required role not granted'
		);
	});
});
