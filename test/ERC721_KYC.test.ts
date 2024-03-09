import {expect} from 'chai';
import {ethers, deployments, getUnnamedAccounts, getNamedAccounts} from 'hardhat';
import {ERC721_KYC} from '../typechain-types';
import {setupUser, setupUsers} from './utils';

const setup = deployments.createFixture(async () => {
	await deployments.fixture('ERC721_KYC');
	const {deployer, accountOne, accountTwo, accountThree} = await getNamedAccounts();
	const contracts = {
		ERC721_KYC: await ethers.getContract<ERC721_KYC>('ERC721_KYC'),
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

describe('ERC721_KYC', function () {
	it('tests deployment', async function () {
		const {ERC721_KYC} = await setup();

		// expect(await ERC721_KYC.name()).equal('PDE_KYC');
		// expect(await ERC721_KYC.symbol()).equal('KYC');
	});

	it('tests tokenURI', async function () {
		const {ERC721_KYC, deployer, accountOne} = await setup();

		await deployer.ERC721_KYC.safeMint(accountOne.address);

		expect(await ERC721_KYC.tokenURI(0)).equal('');

		await deployer.ERC721_KYC.setDefaultTokenURI('DefaultURI');

		expect(await ERC721_KYC.tokenURI(0)).equal('DefaultURI');

		await deployer.ERC721_KYC.setTokenURI(0, 'URI0');

		expect(await ERC721_KYC.tokenURI(0)).equal('URI0');
	});

	it('tests safeMint', async function () {
		const {ERC721_KYC, deployer, accountOne} = await setup();

		await deployer.ERC721_KYC.safeMint(accountOne.address);

		expect(await ERC721_KYC.balanceOf(accountOne.address)).equal(1);
	});

	it('tests burn', async function () {
		const {ERC721_KYC, deployer, accountOne} = await setup();

		await deployer.ERC721_KYC.safeMint(accountOne.address);

		expect(await ERC721_KYC.balanceOf(accountOne.address)).equal(1);

		await deployer.ERC721_KYC.burn(0);

		expect(await ERC721_KYC.balanceOf(accountOne.address)).equal(0);
	});

	it('tests safeTransfer', async function () {
		const {ERC721_KYC, deployer, accountOne, accountTwo} = await setup();

		await deployer.ERC721_KYC.safeMint(accountOne.address);

		expect(await ERC721_KYC.balanceOf(accountOne.address)).equal(1);
		expect(await ERC721_KYC.balanceOf(accountTwo.address)).equal(0);

		await deployer.ERC721_KYC['safeTransferFrom(address,address,uint256)'](
			accountOne.address,
			accountTwo.address,
			0
		);

		expect(await ERC721_KYC.balanceOf(accountOne.address)).equal(0);
		expect(await ERC721_KYC.balanceOf(accountTwo.address)).equal(1);
	});

	it('tests accessRoles', async function () {
		const {accountOne} = await setup();

		await expect(accountOne.ERC721_KYC.safeMint(accountOne.address)).to.be.revertedWith(
			'KYC: required role not granted'
		);
	});
});
